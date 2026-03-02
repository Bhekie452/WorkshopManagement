"""
Backend Messaging Service for SMS/WhatsApp workflows.

Provides unified interface for sending SMS/WhatsApp notifications
with template rendering, phone formatting, and message logging.
"""

import os
import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class MessagingTemplates:
    """Message templates for various workflow triggers."""
    
    TEMPLATES = {
        'job_received': {
            'name': 'Job Received',
            'channel': 'SMS',
            'content': 'Hi {customerName}, your vehicle {vehicleReg} has been received. Job #{jobNumber}. We\'ll keep you updated. - {workshopName}',
        },
        'job_in_progress': {
            'name': 'Job In Progress',
            'channel': 'SMS',
            'content': 'Hi {customerName}, work has started on your {vehicleReg}. Estimated completion: {dueDate}. Job #{jobNumber}. - {workshopName}',
        },
        'job_ready': {
            'name': 'Job Ready',
            'channel': 'SMS',
            'content': 'Hi {customerName}, your {vehicleReg} is ready for collection! Total: R{totalCost}. Job #{jobNumber}. - {workshopName}',
        },
        'job_completion': {
            'name': 'Job Completed',
            'channel': 'SMS',
            'content': 'Hi {customerName}, work on your {vehicleReg} is complete. Invoice #{invoiceNumber}: R{totalCost}. Please visit us for collection. - {workshopName}',
        },
        'appointment_confirmation': {
            'name': 'Appointment Confirmation',
            'channel': 'SMS',
            'content': 'Hi {customerName}, your appointment for {appointmentType} is confirmed for {appointmentDate} at {appointmentTime}. - {workshopName}',
        },
        'appointment_reminder': {
            'name': 'Appointment Reminder',
            'channel': 'SMS',
            'content': 'Hi {customerName}, reminder: Your {appointmentType} is scheduled for {appointmentDate} at {appointmentTime}. - {workshopName}',
        },
        'invoice_created': {
            'name': 'Invoice Created',
            'channel': 'SMS',
            'content': 'Hi {customerName}, Invoice #{invoiceNumber} for R{totalCost} is ready. Due: {dueDate}. Pay via EFT or visit us. - {workshopName}',
        },
        'invoice_reminder': {
            'name': 'Invoice Reminder',
            'channel': 'SMS',
            'content': 'Hi {customerName}, reminder: Invoice #{invoiceNumber} for R{totalCost} is due on {dueDate}. - {workshopName}',
        },
        'payment_confirmed': {
            'name': 'Payment Confirmed',
            'channel': 'SMS',
            'content': 'Hi {customerName}, payment received for Invoice #{invoiceNumber}. Amount: R{totalCost}. Thank you! - {workshopName}',
        },
        'satisfaction_survey': {
            'name': 'Satisfaction Survey',
            'channel': 'SMS',
            'content': 'Hi {customerName}, how was your service with us? Reply with: 1=Poor, 2=Fair, 3=Good, 4=Excellent. - {workshopName}',
        },
    }
    
    @classmethod
    def render(cls, template_id: str, variables: Dict[str, str]) -> Optional[str]:
        """Render template with variables."""
        if template_id not in cls.TEMPLATES:
            return None
        
        content = cls.TEMPLATES[template_id]['content']
        for key, value in variables.items():
            content = content.replace(f'{{{key}}}', str(value))
        return content


class MessagingService:
    """Service for sending SMS/WhatsApp messages via backend SMS service."""
    
    def __init__(self, sms_service=None, db: Optional[Session] = None):
        """
        Initialize messaging service.
        
        Args:
            sms_service: Backend SMSService instance (Twilio integration)
            db: SQLAlchemy session for logging
        """
        self.sms_service = sms_service
        self.db = db
        self.is_configured = bool(sms_service and sms_service.is_configured)
    
    async def send_message(
        self,
        template_id: str,
        customer_id: str,
        company_id: str,
        recipient_phone: str,
        variables: Dict[str, str],
        trigger_event: str,
        job_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
        appointment_id: Optional[str] = None,
    ) -> bool:
        """
        Send SMS/WhatsApp message based on template.
        
        Args:
            template_id: Template identifier (job_received, appointment_confirmation, etc.)
            customer_id: Customer ID for tracking
            company_id: Company ID for multi-tenancy
            recipient_phone: Phone number to send to
            variables: Template variables to render
            trigger_event: Event that triggered the message
            job_id: Optional job ID for context
            invoice_id: Optional invoice ID for context
            appointment_id: Optional appointment ID for context
        
        Returns:
            True if message sent successfully, False otherwise
        """
        # Render template
        message_content = MessagingTemplates.render(template_id, variables)
        if not message_content:
            logger.error(f'Template {template_id} not found')
            return False
        
        # Get template info
        template_info = MessagingTemplates.TEMPLATES[template_id]
        template_name = template_info['name']
        channel = template_info['channel']
        
        # Format phone number
        formatted_phone = self._format_phone(recipient_phone)
        
        # Log message (create message log record)
        message_log = None
        if self.db:
            try:
                from db.models import MessageLog, MessageChannelEnum, MessageStatusEnum
                
                message_log = MessageLog(
                    company_id=company_id,
                    customer_id=customer_id,
                    channel=MessageChannelEnum.SMS if channel == 'SMS' else MessageChannelEnum.WHATSAPP,
                    template_id=template_id,
                    template_name=template_name,
                    recipient_phone=formatted_phone,
                    message_content=message_content,
                    job_id=job_id,
                    invoice_id=invoice_id,
                    appointment_id=appointment_id,
                    trigger_event=trigger_event,
                    status=MessageStatusEnum.PENDING,
                )
                self.db.add(message_log)
                self.db.commit()
                self.db.refresh(message_log)
            except Exception as e:
                logger.error(f'Error creating message log: {e}')
                self.db.rollback()
        
        # Send via SMS service
        if not self.is_configured:
            logger.warning(f'SMS service not configured. Message would be: {message_content}')
            return False
        
        try:
            # Send via Twilio
            success = await self.sms_service.send_sms(
                phone=formatted_phone,
                message=message_content,
            )
            
            # Update message log status
            if message_log and self.db:
                from db.models import MessageStatusEnum
                message_log.status = MessageStatusEnum.SENT
                message_log.sent_at = datetime.utcnow()
                self.db.add(message_log)
                self.db.commit()
            
            return success
        except Exception as e:
            logger.error(f'Error sending message: {e}')
            
            # Update message log with error
            if message_log and self.db:
                from db.models import MessageStatusEnum
                message_log.status = MessageStatusEnum.FAILED
                message_log.error_message = str(e)
                self.db.add(message_log)
                self.db.commit()
            
            return False
    
    def _format_phone(self, phone: str) -> str:
        """Format phone number to E.164 format (South African)."""
        cleaned = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        cleaned = ''.join(c for c in cleaned if c.isdigit())
        
        # Handle South African numbers
        if cleaned.startswith('0') and len(cleaned) == 10:
            cleaned = '27' + cleaned[1:]
        
        # Add + prefix if not present
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        return cleaned


# Global messaging service instance
messaging_service: Optional[MessagingService] = None


def init_messaging_service(sms_service):
    """Initialize the global messaging service."""
    global messaging_service
    messaging_service = MessagingService(sms_service=sms_service)


def get_messaging_service() -> Optional[MessagingService]:
    """Get the global messaging service instance."""
    return messaging_service
