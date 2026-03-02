"""PayFast Payment Gateway Integration

Handles PayFast payment processing, signature verification, and ITN webhook handling.
"""
import hashlib
import os
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class PayFastService:
    """Service for PayFast payment gateway integration."""
    
    def __init__(self):
        """Initialize PayFast service with merchant credentials."""
        self.merchant_id = os.getenv('PAYFAST_MERCHANT_ID', '10000100')
        self.merchant_key = os.getenv('PAYFAST_MERCHANT_KEY', '46f0cd694581a')
        self.passphrase = os.getenv('PAYFAST_PASSPHRASE', '')
        self.sandbox = os.getenv('PAYFAST_SANDBOX', 'true').lower() == 'true'
        
        self.base_url = (
            'https://sandbox.payfast.co.za' if self.sandbox
            else 'https://payfast.co.za'
        )
        
        self.redirect_url = f'{self.base_url}/eng/process'
    
    def generate_payment_url(
        self,
        invoice_id: str,
        invoice_number: str,
        amount: float,
        customer_email: str,
        customer_name: str,
        description: str = '',
        return_url: str = '',
        cancel_url: str = '',
        notify_url: str = ''
    ) -> str:
        """
        Generate a PayFast payment URL for an invoice.
        
        Args:
            invoice_id: Database invoice ID
            invoice_number: Invoice number for display
            amount: Payment amount in ZAR
            customer_email: Customer email address
            customer_name: Customer full name
            description: Payment description/item name
            return_url: URL to redirect after payment
            cancel_url: URL to redirect if payment cancelled
            notify_url: URL for PayFast to send ITN webhook
        
        Returns:
            Full PayFast payment redirect URL
        """
        # Prepare payment parameters
        params = {
            'merchant_id': self.merchant_id,
            'merchant_key': self.merchant_key,
            'return_url': return_url,
            'cancel_url': cancel_url,
            'notify_url': notify_url,
            'm_payment_id': invoice_id,
            'amount': f'{amount:.2f}',
            'item_name': description or f'Invoice {invoice_number}',
            'item_description': description or f'Invoice {invoice_number}',
            'email_confirmation': '1',
            'confirmation_address': customer_email,
            'name_first': customer_name.split()[0] if customer_name else '',
            'name_last': ' '.join(customer_name.split()[1:]) if len(customer_name.split()) > 1 else '',
            'email_address': customer_email,
        }
        
        # Generate signature
        signature = self.generate_signature(params)
        params['signature'] = signature
        
        # Build URL
        query_string = '&'.join(
            f'{k}={v}' for k, v in params.items() if v
        )
        
        return f'{self.redirect_url}?{query_string}'
    
    def generate_signature(self, params: Dict[str, str]) -> str:
        """
        Generate PayFast signature (MD5 hash).
        
        Args:
            params: Dictionary of payment parameters
        
        Returns:
            MD5 signature hash
        """
        # Build parameter string (must be in correct order)
        param_string = '&'.join(
            f'{k}={v}' for k, v in params.items() if v
        )
        
        # Add passphrase if configured
        if self.passphrase:
            param_string += f'&passphrase={self.passphrase}'
        
        # Generate MD5 hash
        return hashlib.md5(param_string.encode()).hexdigest()
    
    def verify_webhook_signature(self, data: Dict[str, str], signature: str) -> bool:
        """
        Verify PayFast ITN webhook signature.
        
        Args:
            data: ITN POST data from PayFast
            signature: Signature from PayFast (pf_signature)
        
        Returns:
            True if signature is valid, False otherwise
        """
        # Key order matters for PayFast signature verification
        ordered_keys = [
            'pf_payment_id', 'm_payment_id', 'pf_amount', 'pf_payment_status',
            'reference', 'reason_code', 'sex', 'name_first', 'name_last',
            'email_address', 'cell_number', 'fax_number', 'street_address',
            'city', 'state', 'zip_code', 'country', 'custom_int1', 'custom_int2',
            'custom_int3', 'custom_int4', 'custom_int5', 'custom_str1',
            'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
            'name_first', 'name_last', 'email_confirmation', 'payment_method'
        ]
        
        # Build signature string from webhook data
        param_string = ''
        for key in ordered_keys:
            if key in data:
                param_string += f'{key}={data[key]}&'
        
        # Remove trailing ampersand
        param_string = param_string.rstrip('&')
        
        # Add passphrase
        if self.passphrase:
            param_string += f'&passphrase={self.passphrase}'
        
        # Generate expected signature
        expected_signature = hashlib.md5(param_string.encode()).hexdigest()
        
        # Compare signatures
        is_valid = expected_signature == signature
        
        if not is_valid:
            logger.warning(
                f'PayFast signature mismatch for payment {data.get("m_payment_id")}. '
                f'Expected: {expected_signature}, Got: {signature}'
            )
        
        return is_valid
    
    def validate_itn_data(self, data: Dict[str, str]) -> Tuple[bool, Optional[str]]:
        """
        Validate PayFast ITN webhook data.
        
        Args:
            data: ITN POST data from PayFast
        
        Returns:
            Tuple of (is_valid: bool, error_message: str or None)
        """
        # Check required fields
        required_fields = ['m_payment_id', 'pf_payment_id', 'pf_amount', 'pf_payment_status']
        
        for field in required_fields:
            if field not in data:
                return False, f'Missing required field: {field}'
        
        # Validate payment status is COMPLETE for successful payments
        status = data.get('pf_payment_status', '').upper()
        if status not in ['COMPLETE', 'PENDING', 'FAILED', 'CANCELLED']:
            return False, f'Invalid payment status: {status}'
        
        # Validate amount is positive
        try:
            amount = float(data.get('pf_amount', 0))
            if amount <= 0:
                return False, f'Invalid amount: {amount}'
        except (ValueError, TypeError):
            return False, 'Amount is not a valid number'
        
        return True, None


# Global instance
payfast_service = PayFastService()
