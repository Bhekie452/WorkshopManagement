"""
Backend Email Service - Integration with Node.js Email Server

Sends emails for backend events like payment confirmations,
order status updates, etc. Integrates with the frontend email server.
"""

import httpx
import logging
import os
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via the Node.js email server."""
    
    def __init__(self):
        self.server_url = os.getenv('EMAIL_SERVER_URL', 'http://localhost:3001')
        self.company_info = {
            'name': 'Workshop Management System',
            'email': os.getenv('COMPANY_EMAIL', 'info@workshop.co.za'),
            'phone': os.getenv('COMPANY_PHONE', ''),
            'address': os.getenv('COMPANY_ADDRESS', ''),
        }
    
    def _get_email_header(self) -> str:
        """Get HTML email header with company branding."""
        return f'<h2 style="color: #2563eb;">{self.company_info["name"]}</h2>'
    
    def _get_email_signature(self) -> str:
        """Get HTML email footer with company signature."""
        parts = [
            'Best regards,',
            f'<strong>{self.company_info["name"]}</strong>',
        ]
        
        if self.company_info['phone']:
            parts.append(f'Tel: {self.company_info["phone"]}')
        
        if self.company_info['email']:
            parts.append(f'Email: <a href="mailto:{self.company_info["email"]}">{self.company_info["email"]}</a>')
        
        if self.company_info['address']:
            parts.append(self.company_info['address'])
        
        lines = '<br>'.join(parts)
        return f'<p style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; color: #6b7280; font-size: 0.875rem;">{lines}</p>'
    
    async def send_payment_confirmation(
        self,
        customer_email: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        payment_method: str = 'PayFast',
        job_id: Optional[str] = None
    ) -> bool:
        """
        Send payment confirmation email to customer.
        
        Args:
            customer_email: Customer's email address
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            payment_method: Payment method used (default: PayFast)
            job_id: Optional job ID for context
        
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                {self._get_email_header()}
                <p>Dear {customer_name},</p>
                <p>Thank you for your payment. Your payment has been confirmed and processed. Here are the details:</p>
                
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p><strong>Invoice Number:</strong> {invoice_number}</p>
                    <p><strong>Amount Paid:</strong> R{amount:.2f}</p>
                    <p><strong>Payment Method:</strong> {payment_method}</p>
                    <p><strong>Date:</strong> {datetime.utcnow().strftime('%d %B %Y')}</p>
                    {f'<p><strong>Job ID:</strong> {job_id}</p>' if job_id else ''}
                </div>
                
                <p>Your vehicle is being prepared for collection. We will contact you once it is ready.</p>
                <p>If you have any questions about this payment, please don't hesitate to contact us.</p>
                
                {self._get_email_signature()}
            </div>
            """
            
            return await self._send_email(
                to=customer_email,
                subject=f'Payment Confirmed - Invoice #{invoice_number}',
                html=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email: {e}")
            return False
    
    async def send_payment_failed(
        self,
        customer_email: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        reason: str
    ) -> bool:
        """
        Send payment failure notification to customer.
        
        Args:
            customer_email: Customer's email address
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            reason: Reason for payment failure
        
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                {self._get_email_header()}
                <p>Dear {customer_name},</p>
                <p>Unfortunately, your recent payment attempt was unsuccessful. Please find the details below:</p>
                
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p><strong>Invoice Number:</strong> {invoice_number}</p>
                    <p><strong>Amount:</strong> R{amount:.2f}</p>
                    <p><strong>Reason:</strong> {reason}</p>
                    <p><strong>Date:</strong> {datetime.utcnow().strftime('%d %B %Y')}</p>
                </div>
                
                <p>Please try again or contact us for assistance. We accept various payment methods, and our team is happy to help.</p>
                
                {self._get_email_signature()}
            </div>
            """
            
            return await self._send_email(
                to=customer_email,
                subject=f'Payment Failed - Invoice #{invoice_number}',
                html=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send payment failure email: {e}")
            return False
    
    async def send_payment_reminder(
        self,
        customer_email: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        due_date: str
    ) -> bool:
        """
        Send payment reminder email to customer.
        
        Args:
            customer_email: Customer's email address
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            due_date: Due date for payment
        
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                {self._get_email_header()}
                <p>Dear {customer_name},</p>
                <p>This is a friendly reminder about your outstanding invoice payment. Payment is now due.</p>
                
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p><strong>Invoice Number:</strong> {invoice_number}</p>
                    <p><strong>Amount Due:</strong> R{amount:.2f}</p>
                    <p><strong>Due Date:</strong> {due_date}</p>
                </div>
                
                <p>Please arrange payment at your earliest convenience. You can pay online through our customer portal or contact us for payment arrangements.</p>
                
                {self._get_email_signature()}
            </div>
            """
            
            return await self._send_email(
                to=customer_email,
                subject=f'Payment Reminder - Invoice #{invoice_number}',
                html=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send payment reminder email: {e}")
            return False
    
    async def _send_email(self, to: str, subject: str, html: str) -> bool:
        """
        Send email via the Node.js email server.
        
        Args:
            to: Recipient email address
            subject: Email subject
            html: HTML email content
        
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.server_url}/api/send",
                    json={
                        "to": to,
                        "subject": subject,
                        "html": html,
                        "text": f"Subject: {subject}"
                    }
                )
                
                if response.status_code == 200:
                    logger.info(f"Email sent successfully to {to}")
                    return True
                else:
                    logger.error(f"Email server returned {response.status_code}: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to send email via server: {e}")
            return False


# Create singleton instance
email_service = EmailService()
