"""Tests for PayFast payment integration endpoints."""
import pytest
from datetime import datetime
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from db.database import get_db_context, SessionLocal, engine
from db.models import Base, Company, User, Customer, Invoice, PaymentTransaction, UserRoleEnum, InvoiceStatusEnum, PaymentStatusEnum
import uuid


@pytest.fixture
def db_session():
    """Create a test database session."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    yield db
    
    db.close()
    # Clean up tables
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_company(db_session):
    """Create a test company."""
    company = Company(
        id=str(uuid.uuid4()),
        name="Test Workshop",
        phone="0123456789",
        email="test@workshop.co.za",
    )
    db_session.add(company)
    db_session.commit()
    return company


@pytest.fixture
def test_user(db_session, test_company):
    """Create a test user."""
    user = User(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        email="tech@workshop.co.za",
        password_hash="hashed_password",
        name="Test Technician",
        role=UserRoleEnum.TECHNICIAN,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_customer(db_session, test_company):
    """Create a test customer."""
    customer = Customer(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        name="John Doe",
        email="john@example.com",
        phone="0764228275",
        address="123 Main St, Cape Town",
    )
    db_session.add(customer)
    db_session.commit()
    return customer


@pytest.fixture
def test_invoice(db_session, test_company, test_customer):
    """Create a test invoice."""
    invoice = Invoice(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        customer_id=test_customer.id,
        invoice_type="Invoice",
        invoice_number="INV-001",
        issue_date=datetime.utcnow(),
        due_date=datetime.utcnow(),
        subtotal=1000.0,
        tax_rate=0.15,
        tax_amount=150.0,
        total=1150.0,
        status=InvoiceStatusEnum.DRAFT,
    )
    db_session.add(invoice)
    db_session.commit()
    return invoice


def test_create_payment_transaction(db_session, test_company, test_invoice):
    """Test creating a payment transaction record."""
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        amount=test_invoice.total,
        status=PaymentStatusEnum.PENDING,
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Verify it was created
    assert payment.id is not None
    assert payment.status == PaymentStatusEnum.PENDING
    assert payment.amount == 1150.0


def test_payment_transaction_signature_fields(db_session, test_company, test_invoice):
    """Test payment transaction signature verification fields."""
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        amount=test_invoice.total,
        status=PaymentStatusEnum.PENDING,
        signature_valid=False,
        signature_hash="test_signature_hash_value",
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Retrieve and verify
    retrieved = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payment.id
    ).first()
    
    assert retrieved.signature_valid is False
    assert retrieved.signature_hash == "test_signature_hash_value"


def test_payment_transaction_status_transition(db_session, test_company, test_invoice):
    """Test payment transaction status transitions."""
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        pf_payment_id="pf_12345",
        amount=test_invoice.total,
        status=PaymentStatusEnum.PENDING,
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Update to complete
    payment.status = PaymentStatusEnum.COMPLETE
    payment.completed_at = datetime.utcnow()
    db_session.commit()
    
    # Verify transition
    retrieved = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payment.id
    ).first()
    
    assert retrieved.status == PaymentStatusEnum.COMPLETE
    assert retrieved.completed_at is not None


def test_payment_transaction_with_payfast_response(db_session, test_company, test_invoice):
    """Test storing PayFast response data in payment transaction."""
    payfast_data = {
        "m_payment_id": test_invoice.id,
        "pf_payment_id": "pf_12345",
        "pf_amount": "1150.00",
        "pf_payment_status": "COMPLETE",
        "amount_gross": "1150.00",
        "amount_fee": "-10.00",
        "amount_net": "1140.00",
    }
    
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        pf_payment_id="pf_12345",
        amount=test_invoice.total,
        amount_gross=1150.0,
        amount_fee=-10.0,
        amount_net=1140.0,
        status=PaymentStatusEnum.COMPLETE,
        payfast_response=payfast_data,
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Verify
    retrieved = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payment.id
    ).first()
    
    assert retrieved.payfast_response["pf_payment_id"] == "pf_12345"
    assert retrieved.amount_net == 1140.0


def test_payment_transaction_retry_tracking(db_session, test_company, test_invoice):
    """Test payment transaction retry tracking."""
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        amount=test_invoice.total,
        status=PaymentStatusEnum.FAILED,
        retry_count=1,
        error_message="Connection timeout",
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Increment retry
    payment.retry_count += 1
    payment.last_retry_at = datetime.utcnow()
    db_session.commit()
    
    # Verify
    retrieved = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payment.id
    ).first()
    
    assert retrieved.retry_count == 2
    assert retrieved.last_retry_at is not None


def test_payment_transaction_company_isolation(db_session, test_company):
    """Test payment transactions are properly isolated by company."""
    # Create second company
    company2 = Company(
        id=str(uuid.uuid4()),
        name="Other Workshop",
    )
    db_session.add(company2)
    
    # Create customers for both companies
    customer1 = Customer(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        name="Customer 1",
        email="c1@example.com",
        phone="0764228275",
    )
    customer2 = Customer(
        id=str(uuid.uuid4()),
        company_id=company2.id,
        name="Customer 2",
        email="c2@example.com",
        phone="0764228276",
    )
    
    db_session.add_all([customer1, customer2])
    
    # Create invoices for both companies
    invoice1 = Invoice(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        customer_id=customer1.id,
        invoice_type="Invoice",
        invoice_number="INV-001",
        issue_date=datetime.utcnow(),
        due_date=datetime.utcnow(),
        total=1000.0,
        status=InvoiceStatusEnum.DRAFT,
    )
    invoice2 = Invoice(
        id=str(uuid.uuid4()),
        company_id=company2.id,
        customer_id=customer2.id,
        invoice_type="Invoice",
        invoice_number="INV-002",
        issue_date=datetime.utcnow(),
        due_date=datetime.utcnow(),
        total=2000.0,
        status=InvoiceStatusEnum.DRAFT,
    )
    
    db_session.add_all([invoice1, invoice2])
    db_session.commit()
    
    # Create payments for both
    payment1 = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=invoice1.id,
        payment_id="INV-001",
        amount=1000.0,
        status=PaymentStatusEnum.PENDING,
    )
    payment2 = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=company2.id,
        invoice_id=invoice2.id,
        payment_id="INV-002",
        amount=2000.0,
        status=PaymentStatusEnum.PENDING,
    )
    
    db_session.add_all([payment1, payment2])
    db_session.commit()
    
    # Query company1 payments - should only get payment1
    company1_payments = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.company_id == test_company.id
    ).all()
    
    assert len(company1_payments) == 1
    assert company1_payments[0].id == payment1.id


def test_payment_history_retrieval(db_session, test_company, test_customer, test_invoice):
    """Test retrieving payment history for an invoice."""
    from datetime import timedelta
    
    # Create multiple payments for the same invoice with different timestamps
    now = datetime.utcnow()
    payment1 = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=f"{test_invoice.id}_1",
        amount=500.0,
        status=PaymentStatusEnum.FAILED,
        error_message="Connection timeout",
        created_at=now - timedelta(hours=2),  # 2 hours ago
    )
    payment2 = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=f"{test_invoice.id}_2",
        amount=test_invoice.total,
        status=PaymentStatusEnum.COMPLETE,
        pf_payment_id="pf_12345",
        created_at=now,  # Just now (most recent)
    )
    
    db_session.add_all([payment1, payment2])
    db_session.commit()
    
    # Retrieve history (ordered by created_at DESC)
    history = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.invoice_id == test_invoice.id,
        PaymentTransaction.company_id == test_company.id
    ).order_by(PaymentTransaction.created_at.desc()).all()
    
    assert len(history) == 2
    # Most recent should be COMPLETE
    assert history[0].status == PaymentStatusEnum.COMPLETE
    # Earlier should be FAILED
    assert history[1].status == PaymentStatusEnum.FAILED


def test_payment_refund_workflow(db_session, test_company, test_customer, test_invoice):
    """Test refund workflow marking payment as cancelled."""
    # Create a completed payment
    payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        amount=test_invoice.total,
        status=PaymentStatusEnum.COMPLETE,
        pf_payment_id="pf_12345",
    )
    
    db_session.add(payment)
    db_session.commit()
    
    # Simulate refund workflow
    payment.status = PaymentStatusEnum.CANCELLED
    payment.error_message = "Customer requested refund"
    payment.payfast_response = payment.payfast_response or {}
    payment.payfast_response['refund_requested'] = True
    payment.payfast_response['refund_amount'] = test_invoice.total
    
    # Update invoice status
    test_invoice.status = InvoiceStatusEnum.CANCELLED
    
    db_session.commit()
    
    # Verify refund state
    retrieved_payment = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payment.id
    ).first()
    
    retrieved_invoice = db_session.query(Invoice).filter(
        Invoice.id == test_invoice.id
    ).first()
    
    assert retrieved_payment.status == PaymentStatusEnum.CANCELLED
    assert retrieved_payment.payfast_response['refund_requested'] is True
    assert retrieved_invoice.status == InvoiceStatusEnum.CANCELLED


def test_payment_method_tracking(db_session, test_company, test_invoice):
    """Test tracking different payment methods."""
    # Create payment with PayFast method
    payfast_payment = PaymentTransaction(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        invoice_id=test_invoice.id,
        payment_id=test_invoice.id,
        amount=test_invoice.total,
        payment_method="PayFast",
        status=PaymentStatusEnum.COMPLETE,
    )
    
    db_session.add(payfast_payment)
    db_session.commit()
    
    # Retrieve and verify
    retrieved = db_session.query(PaymentTransaction).filter(
        PaymentTransaction.id == payfast_payment.id
    ).first()
    
    assert retrieved.payment_method == "PayFast"


def test_payment_reminder_data_requirements(db_session, test_company, test_customer):
    """Test that customer has required fields for payment reminders."""
    # Verify test customer has email and phone for reminders
    assert test_customer.email is not None
    assert test_customer.email != ""
    assert test_customer.phone is not None
    assert test_customer.phone != ""
    
    # Create a past-due invoice
    invoice = Invoice(
        id=str(uuid.uuid4()),
        company_id=test_company.id,
        customer_id=test_customer.id,
        invoice_type="Invoice",
        invoice_number="INV-PAST-DUE",
        issue_date=datetime(2026, 1, 1),
        due_date=datetime(2026, 2, 1),  # Past due
        total=1000.0,
        status=InvoiceStatusEnum.OVERDUE,
    )
    
    db_session.add(invoice)
    db_session.commit()
    
    # Verify invoice is overdue
    assert invoice.due_date < datetime.utcnow()
    assert invoice.status == InvoiceStatusEnum.OVERDUE


if __name__ == "__main__":
    # Run with: pytest backend/tests/test_payments.py -v
    pytest.main([__file__, "-v"])
