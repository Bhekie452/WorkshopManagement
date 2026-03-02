"""
Backend SMS Service - Integration with SMS Provider (Twilio)

Sends SMS notifications for backend events like payment confirmations,
payment failures, etc. Integrates with Twilio API.
"""

import httpx
import logging
import os
from typing import Optional
from datetime import datetime
import base64

logger = logging.getLogger(__name__)


class SMSService:
    """Service for sending SMS messages via Twilio."""
    
    def __init__(self):
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.phone_number = os.getenv('TWILIO_PHONE_NUMBER', '')
        self.is_configured = bool(self.account_sid and self.auth_token and self.phone_number)
        self.twilio_api_url = 'https://api.twilio.com/2010-04-01'
    
    def _format_phone_number(self, phone: str) -> str:
        """
        Format phone number to E.164 format.
        
        Handles South African numbers:
        - 0718293847 -> +27718293847
        - +27718293847 -> +27718293847
        - 27718293847 -> +27718293847
        
        Args:
            phone: Phone number in various formats
        
        Returns:
            Phone number in E.164 format
        """
        # Remove all non-digit characters
        cleaned = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        cleaned = ''.join(c for c in cleaned if c.isdigit())
        
        # Handle South African numbers
        if cleaned.startswith('0') and len(cleaned) == 10:
            cleaned = '27' + cleaned[1:]
        
        # Add + prefix if not present
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        return cleaned
    
    async def send_payment_confirmation(
        self,
        customer_phone: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        company_name: str = 'Workshop Management System'
    ) -> bool:
        """
        Send payment confirmation SMS to customer.
        
        Args:
            customer_phone: Customer's phone number
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            company_name: Company/workshop name
        
        Returns:
            True if SMS sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.warning('SMS not configured. Skipping payment confirmation SMS.')
            return False
        
        try:
            phone = self._format_phone_number(customer_phone)
            
            message = f"Hi {customer_name}, payment received for Invoice #{invoice_number}. Amount: R{amount:.2f}. Thank you! - {company_name}"
            
            return await self._send_sms(phone, message)
        except Exception as e:
            logger.error(f"Failed to send payment confirmation SMS: {e}")
            return False
    
    async def send_payment_failed(
        self,
        customer_phone: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        company_name: str = 'Workshop Management System'
    ) -> bool:
        """
        Send payment failure notification SMS to customer.
        
        Args:
            customer_phone: Customer's phone number
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            company_name: Company/workshop name
        
        Returns:
            True if SMS sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.warning('SMS not configured. Skipping payment failure SMS.')
            return False
        
        try:
            phone = self._format_phone_number(customer_phone)
            
            message = f"Hi {customer_name}, your payment for Invoice #{invoice_number} (R{amount:.2f}) was unsuccessful. Please try again or contact us. - {company_name}"
            
            return await self._send_sms(phone, message)
        except Exception as e:
            logger.error(f"Failed to send payment failure SMS: {e}")
            return False
    
    async def send_payment_reminder(
        self,
        customer_phone: str,
        customer_name: str,
        invoice_number: str,
        amount: float,
        due_date: str,
        company_name: str = 'Workshop Management System'
    ) -> bool:
        """
        Send payment reminder SMS to customer.
        
        Args:
            customer_phone: Customer's phone number
            customer_name: Customer's name
            invoice_number: Invoice number for reference
            amount: Payment amount in ZAR
            due_date: Due date for payment
            company_name: Company/workshop name
        
        Returns:
            True if SMS sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.warning('SMS not configured. Skipping payment reminder SMS.')
            return False
        
        try:
            phone = self._format_phone_number(customer_phone)
            
            message = f"Hi {customer_name}, reminder: Invoice #{invoice_number} for R{amount:.2f} is due on {due_date}. Please arrange payment. - {company_name}"
            
            return await self._send_sms(phone, message)
        except Exception as e:
            logger.error(f"Failed to send payment reminder SMS: {e}")
            return False
    
    async def send_sms(self, phone: str, message: str) -> bool:
        """
        Send a generic SMS message.
        
        Args:
            phone: Recipient phone number (any format, will be normalized)
            message: SMS message content
        
        Returns:
            True if SMS sent successfully, False otherwise
        """
        try:
            formatted_phone = self._format_phone_number(phone)
            return await self._send_sms(formatted_phone, message)
        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            return False
    
    async def _send_sms(self, to_phone: str, message: str) -> bool:
        """
        Send SMS via Twilio API.
        
        Args:
            to_phone: Recipient phone number in E.164 format
            message: SMS message content (max 160 characters for single SMS)
        
        Returns:
            True if SMS sent successfully, False otherwise
        """
        try:
            if not self.is_configured:
                logger.warning(f"SMS service not configured. Message would be: {message}")
                return False
            
            # Create Basic Auth header
            auth_string = f"{self.account_sid}:{self.auth_token}"
            auth_bytes = auth_string.encode('utf-8')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.twilio_api_url}/Accounts/{self.account_sid}/Messages.json",
                    headers={
                        'Authorization': f'Basic {auth_b64}',
                    },
                    data={
                        'From': self.phone_number,
                        'To': to_phone,
                        'Body': message,
                    }
                )
                
                if response.status_code in (200, 201):
                    data = response.json()
                    logger.info(f"SMS sent successfully to {to_phone}")
                    return True
                else:
                    logger.error(f"Twilio API error {response.status_code}: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to send SMS via Twilio: {e}")
            return False


# Create singleton instance
sms_service = SMSService()
