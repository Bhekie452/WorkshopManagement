from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import get_db
from db.models import VoiceCommand

import re
from typing import List, Optional, Dict, Any

router = APIRouter(tags=["Voice"])

class VoiceCommandCreate(BaseModel):
    command_text: str
    response_text: str = None
    success: bool = True
    context: str = None

class VoiceProcessRequest(BaseModel):
    transcript: str

class VoiceAction(BaseModel):
    type: str  # NAVIGATION, DATA_UPDATE, RESPONSE
    payload: Dict[str, Any]

class VoiceResponse(BaseModel):
    text: str
    action: Optional[VoiceAction] = None

@router.post("/voice/command", status_code=201)
def log_voice_command(
    payload: VoiceCommandCreate,
    db: Session = Depends(get_db),
):
    cmd = VoiceCommand(
        id=str(uuid4()),
        command_text=payload.command_text,
        response_text=payload.response_text,
        success=payload.success,
        context=payload.context,
        created_at=datetime.utcnow()
    )
    db.add(cmd)
    db.commit()
    return {"id": cmd.id}

@router.post("/voice/process", response_model=VoiceResponse)
async def process_voice_command(
    request: VoiceProcessRequest,
    db: Session = Depends(get_db),
    # Note: Authentication ignored for simplicity in this step, 
    # but normally we'd use current_user: User = Depends(get_current_user)
):
    transcript = request.transcript.lower()
    
    # 1. NAVIGATION COMMANDS
    if any(word in transcript for word in ["go to", "open", "show me"]):
        if "job" in transcript:
            return VoiceResponse(
                text="Opening job management.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/jobs"})
            )
        if "inventory" in transcript or "parts" in transcript:
            return VoiceResponse(
                text="Opening inventory.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/inventory"})
            )
        if "customer" in transcript:
            return VoiceResponse(
                text="Opening customer database.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/customers"})
            )
        if "invoice" in transcript or "billing" in transcript:
            return VoiceResponse(
                text="Opening invoices.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/sales"})
            )
        if "schedule" in transcript or "calendar" in transcript:
            return VoiceResponse(
                text="Opening schedule.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/schedule"})
            )
        if "dashboard" in transcript:
            return VoiceResponse(
                text="Returning to dashboard.",
                action=VoiceAction(type="NAVIGATION", payload={"path": "/"})
            )

    # 2. CREATE NEW JOB
    match = re.search(r"create (?:a )?new job for (.+)", transcript)
    if match:
        customer_name = match.group(1).title()
        # Find customer by name
        from db.models import Customer
        customer = db.query(Customer).filter(Customer.name.ilike(f"%{customer_name}%")).first()
        if customer:
            return VoiceResponse(
                text=f"Creating a new job for {customer.name}.",
                action=VoiceAction(type="NAVIGATION", payload={"path": f"/jobs/new?customer_id={customer.id}"})
            )
        return VoiceResponse(text=f"I couldn't find a customer named {customer_name}.")

    # 3. LIST LOW STOCK PARTS
    if "low stock" in transcript or "out of stock" in transcript:
        from db.models import Part
        low_stock = db.query(Part).filter(Part.quantity <= Part.min_level).all()
        if low_stock:
            part_names = ", ".join([p.name for p in low_stock[:3]])
            count = len(low_stock)
            response_text = f"You have {count} items with low stock. Including: {part_names}."
            if count > 3:
                response_text += f" and {count - 3} others."
            return VoiceResponse(
                text=response_text,
                action=VoiceAction(type="NAVIGATION", payload={"path": "/inventory?filter=low_stock"})
            )
        return VoiceResponse(text="All parts are currently well stocked.")

    # 4. REVENUE QUERY
    if "revenue" in transcript and ("month" in transcript or "current" in transcript):
        from db.models import Invoice
        from datetime import datetime
        now = datetime.utcnow()
        first_day = datetime(now.year, now.month, 1)
        invoices = db.query(Invoice).filter(
            Invoice.issue_date >= first_day,
            Invoice.status == "Paid"
        ).all()
        total = sum(i.total for i in invoices)
        return VoiceResponse(
            text=f"Your total revenue for this month is {total:.2f} rands.",
            action=VoiceAction(type="RESPONSE", payload={"value": total})
        )

    # 5. MARK JOB AS STATUS
    match = re.search(r"mark job (.+) as (.+)", transcript)
    if match:
        job_number = match.group(1).upper()
        new_status = match.group(2).title()
        from db.models import Job, JobStatusEnum
        # Map spoken status to Enum
        status_map = {
            "Pending": JobStatusEnum.PENDING,
            "In Progress": JobStatusEnum.IN_PROGRESS,
            "Awaiting Parts": JobStatusEnum.AWAITING_PARTS,
            "Completed": JobStatusEnum.COMPLETED,
            "Paid": JobStatusEnum.PAID,
            "Cancelled": JobStatusEnum.CANCELLED
        }
        status_enum = status_map.get(new_status)
        if status_enum:
            job = db.query(Job).filter(Job.job_number == job_number).first()
            if job:
                job.status = status_enum
                db.commit()
                return VoiceResponse(
                    text=f"Job {job_number} has been marked as {new_status}.",
                    action=VoiceAction(type="DATA_UPDATE", payload={"entity": "job", "id": job.id, "status": new_status})
                )
            return VoiceResponse(text=f"I couldn't find job number {job_number}.")
        return VoiceResponse(text=f"I don't recognize the status {new_status}.")

    # 6. GENERATE INVOICE
    match = re.search(r"generate (?:an )?invoice for (?:job )?(.+)", transcript)
    if match:
        job_id = match.group(1).upper()
        return VoiceResponse(
            text=f"Generating invoice for job {job_id}.",
            action=VoiceAction(type="NAVIGATION", payload={"path": f"/sales/new?job_id={job_id}"})
        )

    # 7. SHOW JOBS FOR DATE
    if "show jobs for" in transcript:
        date_str = transcript.split("for")[-1].strip()
        # Handle "today", "tomorrow"
        # For now, just navigate to jobs with a date filter
        return VoiceResponse(
            text=f"Showing jobs for {date_str}.",
            action=VoiceAction(type="NAVIGATION", payload={"path": f"/jobs?date={date_str}"})
        )

    return VoiceResponse(
        text="I'm sorry, I don't know how to process that command yet.",
        action=None
    )

@router.get("/voice/history")
def get_voice_history(
    db: Session = Depends(get_db),
):
    q = db.query(VoiceCommand)
    return [
        {
            "id": c.id,
            "command_text": c.command_text,
            "response_text": c.response_text,
            "success": c.success,
            "context": c.context,
            "created_at": c.created_at
        }
        for c in q.order_by(VoiceCommand.created_at.desc()).limit(100)
    ]
