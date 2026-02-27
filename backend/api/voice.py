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

router = APIRouter(tags=["Voice"])

class VoiceCommandCreate(BaseModel):
    command_text: str
    response_text: str = None
    success: bool = True
    context: str = None

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
