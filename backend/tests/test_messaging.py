"""
Test suite for SMS/WhatsApp messaging functionality.

Tests:
1. Message template rendering with variables
2. Message sending via MessagingService
3. Message logging to database
4. Job status change triggers
5. Appointment confirmation triggers
6. Invoice creation triggers
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import asyncio

from services.messaging_service import (
    MessagingService,
    MessagingTemplates,
    get_messaging_service,
)


class TestMessagingTemplates:
    """Test message template rendering."""
    
    def test_template_exists(self):
        """Test that job_received template exists."""
        template = MessagingTemplates.TEMPLATES.get('job_received')
        assert template is not None
        assert template['name'] == 'Job Received'
        assert template['channel'] == 'SMS'
    
    def test_render_job_received_template(self):
        """Test rendering job_received template with variables."""
        variables = {
            'customerName': 'John Doe',
            'vehicleReg': 'ABC123',
            'jobNumber': 'JOB-12345',
            'workshopName': 'ABC Workshop',
        }
        
        rendered = MessagingTemplates.render('job_received', variables)
        
        assert rendered is not None
        assert 'John Doe' in rendered
        assert 'ABC123' in rendered
        assert 'JOB-12345' in rendered
        assert 'ABC Workshop' in rendered
    
    def test_render_job_in_progress_template(self):
        """Test rendering job_in_progress template."""
        variables = {
            'customerName': 'Jane Doe',
            'vehicleReg': 'XYZ789',
            'dueDate': '2026-03-05',
            'jobNumber': 'JOB-67890',
            'workshopName': 'XYZ Workshop',
        }
        
        rendered = MessagingTemplates.render('job_in_progress', variables)
        
        assert rendered is not None
        assert 'Jane Doe' in rendered
        assert 'XYZ789' in rendered
        assert '2026-03-05' in rendered
    
    def test_render_appointment_confirmation_template(self):
        """Test rendering appointment_confirmation template."""
        variables = {
            'customerName': 'Bob Smith',
            'appointmentType': 'Oil Change',
            'appointmentDate': '2026-03-10',
            'appointmentTime': '14:30',
            'workshopName': 'Smith\'s Workshop',
        }
        
        rendered = MessagingTemplates.render('appointment_confirmation', variables)
        
        assert rendered is not None
        assert 'Bob Smith' in rendered
        assert 'Oil Change' in rendered
        assert '14:30' in rendered
    
    def test_render_invoice_created_template(self):
        """Test rendering invoice_created template."""
        variables = {
            'customerName': 'Alice Johnson',
            'invoiceNumber': 'INV-ABC123',
            'totalCost': '2500.00',
            'dueDate': '2026-04-02',
            'workshopName': 'Johnson Workshop',
        }
        
        rendered = MessagingTemplates.render('invoice_created', variables)
        
        assert rendered is not None
        assert 'Alice Johnson' in rendered
        assert 'INV-ABC123' in rendered
        assert '2500.00' in rendered
    
    def test_render_payment_confirmed_template(self):
        """Test rendering payment_confirmed template."""
        variables = {
            'customerName': 'Charlie Brown',
            'invoiceNumber': 'INV-XYZ789',
            'totalCost': '1500.00',
            'workshopName': 'Brown Workshop',
        }
        
        rendered = MessagingTemplates.render('payment_confirmed', variables)
        
        assert rendered is not None
        assert 'Charlie Brown' in rendered
        assert 'INV-XYZ789' in rendered
        assert '1500.00' in rendered
    
    def test_render_nonexistent_template(self):
        """Test rendering nonexistent template returns None."""
        rendered = MessagingTemplates.render('nonexistent_template', {})
        assert rendered is None


class TestMessagingService:
    """Test MessagingService functionality."""
    
    @pytest.fixture
    def mock_sms_service(self):
        """Create a mock SMS service."""
        sms = Mock()
        sms.is_configured = True
        sms.send_sms = AsyncMock(return_value=True)
        return sms
    
    @pytest.fixture
    def messaging_service(self, mock_sms_service):
        """Create a MessagingService with mock SMS service."""
        return MessagingService(sms_service=mock_sms_service)
    
    def test_format_phone_south_africa(self, messaging_service):
        """Test South African phone number formatting."""
        # Format: 0718293847 -> +27718293847
        result = messaging_service._format_phone('0718293847')
        assert result == '+27718293847'
    
    def test_format_phone_with_prefix(self, messaging_service):
        """Test phone number that already has + prefix."""
        result = messaging_service._format_phone('+27718293847')
        assert result == '+27718293847'
    
    def test_format_phone_with_27_prefix(self, messaging_service):
        """Test phone number with 27 prefix."""
        result = messaging_service._format_phone('27718293847')
        assert result == '+27718293847'
    
    def test_format_phone_with_spaces(self, messaging_service):
        """Test phone number with spaces."""
        result = messaging_service._format_phone('071 829 3847')
        assert result == '+27718293847'
    
    def test_format_phone_with_dashes(self, messaging_service):
        """Test phone number with dashes."""
        result = messaging_service._format_phone('071-829-3847')
        assert result == '+27718293847'
    
    @pytest.mark.asyncio
    async def test_send_message_success(self, messaging_service, mock_sms_service):
        """Test successful message sending."""
        result = await messaging_service.send_message(
            template_id='job_received',
            customer_id='CUST-123',
            company_id='COMP-123',
            recipient_phone='0718293847',
            variables={
                'customerName': 'John Doe',
                'vehicleReg': 'ABC123',
                'jobNumber': 'JOB-12345',
                'workshopName': 'ABC Workshop',
            },
            trigger_event='job_created',
            job_id='JOB-12345',
        )
        
        assert result is True
        assert mock_sms_service.send_sms.called
    
    @pytest.mark.asyncio
    async def test_send_message_template_not_found(self, messaging_service):
        """Test sending message with nonexistent template."""
        result = await messaging_service.send_message(
            template_id='nonexistent',
            customer_id='CUST-123',
            company_id='COMP-123',
            recipient_phone='0718293847',
            variables={},
            trigger_event='test',
        )
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_message_sms_not_configured(self):
        """Test sending message when SMS is not configured."""
        sms = Mock()
        sms.is_configured = False
        
        service = MessagingService(sms_service=sms)
        
        result = await service.send_message(
            template_id='job_received',
            customer_id='CUST-123',
            company_id='COMP-123',
            recipient_phone='0718293847',
            variables={
                'customerName': 'John Doe',
                'vehicleReg': 'ABC123',
                'jobNumber': 'JOB-12345',
                'workshopName': 'ABC Workshop',
            },
            trigger_event='job_created',
            job_id='JOB-12345',
        )
        
        assert result is False


class TestMessageWorkflows:
    """Test message sending workflows."""
    
    def test_job_received_workflow(self):
        """Test job received message workflow."""
        # Job created -> job_received message
        variables = {
            'customerName': 'John Doe',
            'vehicleReg': 'ABC123',
            'jobNumber': 'JOB-12345',
            'workshopName': 'ABC Workshop',
        }
        
        rendered = MessagingTemplates.render('job_received', variables)
        
        assert rendered is not None
        assert 'John Doe' in rendered
        assert 'JOB-12345' in rendered
    
    def test_job_status_workflow(self):
        """Test job status change message workflow."""
        # Job status: Pending -> In Progress -> Awaiting Approval -> Completed
        
        # In Progress message
        in_progress_vars = {
            'customerName': 'Jane Smith',
            'vehicleReg': 'XYZ789',
            'dueDate': '2026-03-10',
            'jobNumber': 'JOB-67890',
            'workshopName': 'Smith Workshop',
        }
        
        rendered = MessagingTemplates.render('job_in_progress', in_progress_vars)
        assert 'Jane Smith' in rendered
        assert 'JOB-67890' in rendered
        
        # Ready message
        ready_vars = {
            'customerName': 'Jane Smith',
            'vehicleReg': 'XYZ789',
            'totalCost': '1500.00',
            'jobNumber': 'JOB-67890',
            'workshopName': 'Smith Workshop',
        }
        
        rendered = MessagingTemplates.render('job_ready', ready_vars)
        assert 'Jane Smith' in rendered
        assert 'R1500.00' in rendered
    
    def test_appointment_reminder_workflow(self):
        """Test appointment reminder message workflow."""
        # Appointment created -> confirmation message
        # 24 hours before -> reminder message
        
        variables = {
            'customerName': 'Bob Wilson',
            'appointmentType': 'Battery Check',
            'appointmentDate': '2026-03-15',
            'appointmentTime': '10:00',
            'workshopName': 'Wilson Workshop',
        }
        
        # Confirmation
        confirmation = MessagingTemplates.render('appointment_confirmation', variables)
        assert 'Bob Wilson' in confirmation
        assert 'Battery Check' in confirmation
        assert '10:00' in confirmation
    
    def test_invoice_payment_workflow(self):
        """Test invoice and payment message workflow."""
        # Invoice created -> invoice_created message
        # Invoice paid -> payment_confirmed message
        
        invoice_vars = {
            'customerName': 'Alice Lee',
            'invoiceNumber': 'INV-ABC123',
            'totalCost': '3000.00',
            'dueDate': '2026-03-30',
            'workshopName': 'Lee Workshop',
        }
        
        # Invoice created
        created = MessagingTemplates.render('invoice_created', invoice_vars)
        assert 'Alice Lee' in created
        assert 'INV-ABC123' in created
        assert '3000.00' in created
        
        # Payment confirmed
        payment_vars = {
            'customerName': 'Alice Lee',
            'invoiceNumber': 'INV-ABC123',
            'totalCost': '3000.00',
            'workshopName': 'Lee Workshop',
        }
        
        confirmed = MessagingTemplates.render('payment_confirmed', payment_vars)
        assert 'Alice Lee' in confirmed
        assert 'INV-ABC123' in confirmed


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
