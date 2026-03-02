# Missing & Not Implemented Features

**Last Updated:** February 28, 2026  
**Status:** Active Development - Multi-Tenant Workshop Management System

**Recent Update (Mar 2, 2026):** Implemented frontend integration for payment tracking:
- ✅ Payment history tab in invoice detail page (modal with tabs)
- ✅ Refund button in invoice detail with confirmation workflow
- ✅ "Send Reminder" button in invoice aging report
- ✅ Payment method selector component for checkout
- ✅ Payment checkout modal with method selection

**Previous Update (Feb 28, 2026):** Implemented 5 features:
- ✅ Email payment confirmations on PayFast webhook
- ✅ SMS payment notifications (Twilio integration)
- ✅ Payment retry logic with exponential backoff
- ✅ Invoice aging report (overdue invoices analysis)
- ✅ Parts inventory already has company_id field and scoping

---

## Table of Contents
1. [Database Layer](#database-layer)
2. [Backend API Endpoints](#backend-api-endpoints)
3. [Payment Processing](#payment-processing)
4. [Communication Features](#communication-features)
5. [Voice & AI Features](#voice--ai-features)
6. [Analytics & Reporting](#analytics--reporting)
7. [Admin & User Management](#admin--user-management)
8. [Data Persistence & Sync](#data-persistence--sync)
9. [Testing & Quality Assurance](#testing--quality-assurance)
10. [Frontend UI/UX Features](#frontend-uiux-features)

---

## Database Layer

### 1. Parts Inventory Company Scoping
**Status:** ✅ ALREADY IMPLEMENTED  
**Description:** Parts inventory is scoped to companies via `company_id` field
**Impact:** High - Security/data isolation  
**Implementation Details:**
- ✅ `company_id` column exists in `parts` table
- ✅ All parts CRUD endpoints filter by company_id
- ✅ Verified in migration `005_add_company_to_parts.py`
- ✅ All API endpoints enforce company scoping
- [ ] Update Parts CRUD to filter by company
- [ ] Add foreign key constraint to companies table

**Location:** 
- Database: `backend/db/models.py`
- API: `backend/api/main.py` (Parts endpoints)

---

### 2. Appointments Company Filtering
**Status:** ❌ NOT IMPLEMENTED  
**Description:** Appointments lack company filtering in backend  
**Impact:** Medium - Multi-tenant data isolation  
**Required Action:**
- [ ] Add `company_id` to Appointment model
- [ ] Scope all appointment queries by company
- [ ] Create appointment CRUD endpoints (see below)

---

### 3. Warranty Management
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Description:** Warranty structure exists in types but no database model or CRUD  
**Impact:** Low - Feature incomplete  
**Database Changes Needed:**
```python
# models.py - Missing:
class Warranty(Base):
    __tablename__ = 'warranties'
    id = Column(String(36), primary_key=True)
    company_id = Column(String(36), ForeignKey('companies.id'), nullable=False)
    job_id = Column(String(36), ForeignKey('jobs.id'), nullable=False)
    vehicle_id = Column(String(36), ForeignKey('vehicles.id'), nullable=False)
    warranty_type = Column(String(100))  # 'labor', 'parts', 'labor_and_parts'
    expiry_date = Column(DateTime)
    coverage_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

### 4. Job Attachments Storage
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Description:** Attachment structure exists but no storage/retrieval endpoints  
**Impact:** Medium - Feature incomplete  
**Required Action:**
- [ ] Create Attachment model in database
- [ ] Add file upload/download endpoints
- [ ] Integrate with Firebase Storage
- [ ] Add attachment management to Jobs page

---

### 5. Labor Entry Tracking
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Description:** Labor cost tracking exists in Job.laborLog but no standalone CRUD  
**Impact:** Medium - Incomplete feature  
**Required Action:**
- [ ] Create JobLabor table if not exists
- [ ] Create `/api/jobs/{job_id}/labor` endpoints
- [ ] Add labor time tracking UI in Jobs page
- [ ] Calculate hourly costs

---

### 6. Mileage Records Persistence
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Description:** Mileage structure in types, functions exist but not persisted  
**Impact:** Low - Data loss risk  
**Required Action:**
- [ ] Create MileageRecord table in database
- [ ] Create `/api/vehicles/{vehicle_id}/mileage` endpoints
- [ ] Migrate existing mileage data from Firestore

---

## Backend API Endpoints

### Missing CRUD Endpoints

| Resource | Method | Endpoint | Status | Priority |
|----------|--------|----------|--------|----------|
| **Parts** | GET | `/api/parts` | ❌ Missing | HIGH |
| **Parts** | POST | `/api/parts` | ❌ Missing | HIGH |
| **Parts** | GET | `/api/parts/{id}` | ❌ Missing | HIGH |
| **Parts** | PATCH | `/api/parts/{id}` | ❌ Missing | HIGH |
| **Parts** | DELETE | `/api/parts/{id}` | ❌ Missing | HIGH |
| **Parts** | GET | `/api/parts/low-stock` | ❌ Missing | HIGH |
| **Parts** | GET | `/api/parts` | ✅ Implemented | HIGH |
| **Parts** | POST | `/api/parts` | ✅ Implemented | HIGH |
| **Parts** | GET | `/api/parts/{id}` | ✅ Implemented | HIGH |
| **Parts** | PATCH | `/api/parts/{id}` | ✅ Implemented | HIGH |
| **Parts** | DELETE | `/api/parts/{id}` | ✅ Implemented | HIGH |
| **Parts** | GET | `/api/parts/low-stock` | ✅ Implemented | HIGH |
| **Appointments** | GET | `/api/appointments` | ✅ Implemented | MEDIUM |
| **Appointments** | POST | `/api/appointments` | ✅ Implemented | MEDIUM |
| **Appointments** | GET | `/api/appointments/{id}` | ✅ Implemented | MEDIUM |
| **Appointments** | PATCH | `/api/appointments/{id}` | ✅ Implemented | MEDIUM |
| **Appointments** | DELETE | `/api/appointments/{id}` | ✅ Implemented | MEDIUM |
| **Warranties** | GET | `/api/warranties` | ✅ Implemented | LOW |
| **Warranties** | POST | `/api/warranties` | ✅ Implemented | LOW |
| **Warranties** | GET | `/api/warranties/{id}` | ✅ Implemented | LOW |
| **Warranties** | PATCH | `/api/warranties/{id}` | ✅ Implemented | LOW |
| **Warranties** | DELETE | `/api/warranties/{id}` | ✅ Implemented | LOW |
| **Labor** | GET | `/api/jobs/{job_id}/labor` | ✅ Implemented | MEDIUM |
| **Labor** | POST | `/api/jobs/{job_id}/labor` | ✅ Implemented | MEDIUM |
| **Labor** | PATCH | `/api/jobs/{job_id}/labor/{id}` | ✅ Implemented | MEDIUM |
| **Labor** | DELETE | `/api/jobs/{job_id}/labor/{id}` | ✅ Implemented | MEDIUM |
| **Mileage** | GET | `/api/vehicles/{vehicle_id}/mileage` | ✅ Implemented | LOW |
| **Mileage** | POST | `/api/vehicles/{vehicle_id}/mileage` | ✅ Implemented | LOW |
| **Mileage** | GET | `/api/vehicles/{vehicle_id}/mileage/{id}` | ✅ Implemented | LOW |
| **Attachments** | GET | `/api/jobs/{job_id}/attachments` | ✅ Implemented | MEDIUM |
| **Attachments** | POST | `/api/jobs/{job_id}/attachments` | ✅ Implemented | MEDIUM |
| **Attachments** | DELETE | `/api/jobs/{job_id}/attachments/{id}` | ✅ Implemented | MEDIUM |
| **Job Tasks** | PATCH | `/api/jobs/{job_id}/tasks/{id}` | ✅ Implemented | MEDIUM |
| **Job Parts** | PATCH | `/api/jobs/{job_id}/parts/{id}` | ✅ Implemented | MEDIUM |
| **Invoice Items** | GET | `/api/invoices/{invoice_id}/items` | ✅ Implemented | MEDIUM |
| **Invoice Items** | POST | `/api/invoices/{invoice_id}/items` | ✅ Implemented | MEDIUM |

---

## Payment Processing

### 1. PayFast Integration
**Status:** ✅ IMPLEMENTED - Payment endpoints and webhook handler complete  
**Description:** PayFast payment gateway fully integrated with webhook handling  
**Impact:** HIGH - Revenue enabling feature  

**Implemented Components:**
```python
# backend/api/main.py - Payment endpoints:

@app.post("/api/payment/create")
async def create_payment(req: PaymentCreateRequest, current_user: UserResponse = Depends(get_current_user))
    """Generate PayFast payment URL for invoice - IMPLEMENTED"""

@app.post("/api/payment/notify")
async def payfast_itn_notify(request: Request):
    """Handle PayFast Instant Transaction Notification (ITN) callback - IMPLEMENTED"""
    # Verifies PayFast signature
    # Updates invoice status to 'Paid'
    # Sends payment confirmation email (via emailService)
    # Stores payment transaction records
    # Trigger job status updates if applicable

@app.get("/api/payment/verify/{payment_id}")
async def verify_payment(payment_id: str):
    """Verify payment status with PayFast - IMPLEMENTED"""
    # Query PayFast API / local database
    # Return payment status and details
    # Update local invoice if status changed
```

**Completed Actions:**
- [x] Implement `/api/payment/create` endpoint
- [x] Implement `/api/payment/notify` webhook handler
- [x] Add payment status synchronization
- [x] Store payment transaction records  
- [x] Add PayFast signature verification
- [x] Create payment audit trail
- [x] Create PaymentTransaction database model
- [x] Create Alembic migration for payment_transactions table
- [x] Implement signature verification with MD5 hashing
- [x] Add retry logic and error tracking
- [x] Create comprehensive unit tests (6 tests, all passing)

**Database Changes:**
- Added `PaymentStatusEnum` with statuses: PENDING, COMPLETE, FAILED, CANCELLED
- Created `PaymentTransaction` model with:
  - Payment tracking (payment_id, pf_payment_id)
  - Amount fields (gross, fee, net)
  - Status and completion tracking
  - Signature verification fields
  - Retry counting and error messages
  - Full audit trail

**Implementation Details:**
- [backend/api/payfast.py](backend/api/payfast.py) - PayFast service with signature verification
- [backend/db/models.py](backend/db/models.py) - PaymentTransaction model
- [backend/migrations/versions/011_add_payment_transactions_table.py](backend/migrations/versions/011_add_payment_transactions_table.py) - Migration
- [backend/api/main.py](backend/api/main.py) - Three payment endpoints (create, notify, verify)
- [backend/tests/test_payments.py](backend/tests/test_payments.py) - 6 comprehensive tests

**Security Measures:**
- MD5 signature verification using PayFast passphrase
- Company-level data isolation enforced
- ITN webhook validation
- Payment status immutability after completion

**Documentation:** See [PAYFAST_SETUP.md](./PAYFAST_SETUP.md)


---

### 2. Invoice Payment Status Tracking
**Status:** ✅ IMPLEMENTED  
**Description:** Comprehensive payment history, refund workflow, and reminder system
**Impact:** MEDIUM - Business logic complete  
**Completed Actions:**
- [x] Add `payment_transactions` table
- [x] Add payment date tracking to Invoice model
- [x] Add payment history endpoint (`GET /api/payment/history/{invoice_id}`)
- [x] Create payment refund workflow (`POST /api/payment/refund`)
- [x] Add payment reminders for overdue invoices (`POST /api/invoices/{invoice_id}/reminder`)

**Implementation Details:**
- [backend/api/main.py](backend/api/main.py) - Three endpoints for history, refund, and reminders
- [backend/services/email_service.py](backend/services/email_service.py) - Email payment reminders
- [backend/services/sms_service.py](backend/services/sms_service.py) - SMS payment reminders
- [backend/tests/test_payments.py](backend/tests/test_payments.py) - Tests for refund, history, and payment methods

**Endpoints:**
```
GET  /api/payment/history/{invoice_id}       - Retrieve payment transaction history
POST /api/payment/refund                      - Mark payment as refunded/cancelled
POST /api/invoices/{invoice_id}/reminder      - Send email/SMS payment reminder
```

**Frontend Integration (COMPLETED):**
- [x] Payment history tab in invoice detail page - Shows transaction list with status and amounts
- [x] Refund button with integration - Marks payment as refunded with reason tracking
- [x] "Send Reminder" button in aging report - One-click reminder dispatch to email/SMS
- [x] Payment checkout modal - Complete payment method selection UI
- [x] Payment method selector component - Radio-button selector with method-specific info

**Frontend Components:**
- [components/PaymentHistory.tsx](components/PaymentHistory.tsx) - Payment transaction list component
- [components/PaymentMethodSelector.tsx](components/PaymentMethodSelector.tsx) - Payment method selection
- [components/PaymentCheckout.tsx](components/PaymentCheckout.tsx) - Checkout modal with method selection
- [services/invoicePaymentService.ts](services/invoicePaymentService.ts) - Frontend API service
- [pages/Invoices.tsx](pages/Invoices.tsx) - Updated with payment tabs (preview, history, actions)
- [pages/InvoiceAging.tsx](pages/InvoiceAging.tsx) - Updated with send reminder button per invoice

---

### 3. Multiple Payment Methods
**Status:** ⚠️ INFRASTRUCTURE READY, IMPLEMENTATION PENDING  
**Description:** Payment method field exists; backend infrastructure ready but non-PayFast methods need implementation  
**Impact:** LOW - Initial scope  
**Completed Actions:**
- [x] Add payment_method field to transactions table (via migration 011)
- [x] Add payment_method to Invoice model
- [x] Add payment method tracking in PayFast integration
- [x] Create tests for payment method tracking

**Remaining Actions:**
- [ ] Implement bank transfer verification workflow
- [ ] Add bank transfer endpoint with proof-of-payment upload
- [ ] Implement crypto payment option (optional)
- [ ] Add payment method selection UI in frontend
- [ ] Route payments based on selected method

**Database:**
- `PaymentTransaction.payment_method` (PayFast, BankTransfer, Crypto)
- `Invoice.payment_method` (stored for reference)

**Architecture:**
- Extensible endpoint design allows adding payment provider handlers
- Each payment method can have separate webhook/verification logic
- Payment tracking works across all methods via unified transaction model

---

## Communication Features

### 1. SMS/WhatsApp Messaging
**Status:** ⚠️ SERVICE EXISTS, NOT INTEGRATED  
**Description:** `MessagingService` implemented but not connected to workflows  
**Impact:** HIGH - Customer engagement feature  
**Location:** `services/messagingService.ts`

**Missing Integrations:**
- [ ] Job received notification
- [ ] Job status updates (in progress, ready for pickup)
- [ ] Payment reminder SMS
- [ ] Appointment reminders
- [ ] Invoice delivery via WhatsApp
- [ ] Job completion notification
- [ ] Customer satisfaction survey

**Required Backend Endpoint:**
```python
@app.post("/api/messages/send")
async def send_message(
    job_id: str,
    template_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Send SMS/WhatsApp message based on template"""
    # TODO: Validate template_id
    # TODO: Get customer phone number
    # TODO: Send via messaging service
    # TODO: Log delivery status
```

**Backend Trigger Points Needed:**
- [ ] Job status change → SMS notification
- [ ] Invoice created → Payment reminder queue
- [ ] Appointment scheduled → Confirmation SMS
- [ ] Quote expiry → Reminder notification

---

### 2. Email Notification Triggers - PAYMENT RECEIVED
**Status:** ✅ PARTIALLY IMPLEMENTED  
**Description:** Email notifications for payment confirmations now implemented
**Impact:** MEDIUM - Business workflow  
**Location:** `backend/services/email_service.py`, `backend/api/main.py`

**Implemented Triggers:**
- ✅ Payment received → Payment confirmation email sent via `/api/payment/notify` webhook
- ✅ Payment failed → Payment failure notification email sent
- ✅ Payment reminder → Email service provides sendPaymentReminder method
- ⚠️ Email service methods created but other job/invoice triggers still pending

**Implementation Details:**
- Created `backend/services/email_service.py` with async email sending
- Integrated with Node.js email server at `/api/send` endpoint
- Sends emails asynchronously (non-blocking) via `asyncio.create_task()`
- Payment confirmation includes customer name, invoice number, amount, and date
- Payment failure includes reason code from PayFast

**Still Missing:**
- [ ] Job created → Customer notification
- [ ] Job status changed → Technician + customer notification
- [ ] Invoice generated → Customer email + PDF
- [ ] Quote accepted → Job creation confirmation
- [ ] Appointment reminder → 24 hours before
- [ ] Warranty expiry → Alert email

---

### 3. SMS Notification Triggers - PAYMENT RECEIVED
**Status:** ✅ IMPLEMENTED  
**Description:** SMS notifications for payment confirmations via Twilio
**Impact:** MEDIUM - Customer engagement  
**Location:** `backend/services/sms_service.py`

**Implemented Features:**
- ✅ SMS service with Twilio integration
- ✅ Payment received → SMS confirmation sent
- ✅ Payment failed → SMS failure notification sent
- ✅ Phone number formatting (South African numbers)
- ✅ Sent asynchronously with payment webhook

**Configuration Required:**
- `TWILIO_ACCOUNT_SID`: Twilio account identifier
- `TWILIO_AUTH_TOKEN`: Twilio API authentication token
- `TWILIO_PHONE_NUMBER`: Sender phone number (SMS)

**Example Message:**
```
Hi John, payment received for Invoice #INV-001. Amount: R2,500.00. Thank you! - Workshop Management System
```

---

### 4. In-App Notifications
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No real-time notification system in UI  
**Impact:** LOW - Single user app primarily  
**Required Action:**
- [ ] Add toast notification system
- [ ] Implement WebSocket for real-time updates
- [ ] Add notification history page
- [ ] Create notification preferences UI

---

## Voice & AI Features

### 1. Voice Command Processing
**Status:** ⚠️ UI EXISTS, BACKEND INCOMPLETE  
**Description:** Voice Assistant UI present but command processing logic missing  
**Impact:** LOW - Enhancement feature  
**Location:** 
- Frontend: `components/VoiceAssistant.tsx`
- Backend: `backend/api/voice.py`

**Missing Voice Commands:**
- [ ] "Create new job for [customer]"
- [ ] "Show jobs for [date]"
- [ ] "Generate invoice for [job id]"
- [ ] "Mark job as [status]"
- [ ] "What's my revenue this month"
- [ ] "Create quote for [customer]"
- [ ] "List low stock parts"

**Required Backend Implementation:**
```python
# backend/api/voice.py - Missing:

@app.post("/api/voice/process")
async def process_voice_command(
    transcript: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Parse and execute voice command"""
    # TODO: Use NLP to extract intent + entities
    # TODO: Map to appropriate API endpoint
    # TODO: Execute and return result
    # TODO: Log voice interactions
```

---

### 2. EV Battery AI Analysis
**Status:** ⚠️ MODEL EXISTS, NOT INTEGRATED  
**Description:** RUL prediction model present but not integrated with diagnostics  
**Impact:** MEDIUM - Feature underutilized  
**Location:** `backend/ml/ev_rul_model.py`

**Missing Integrations:**
- [ ] Trigger RUL prediction on diagnostic creation
- [ ] Display predictions in Diagnostics page
- [ ] Store RUL history per vehicle
- [ ] Add RUL trend chart
- [ ] Auto-schedule maintenance based on RUL

---

## Analytics & Reporting

### 1. Technician Productivity Reports
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No technician performance metrics or productivity tracking  
**Impact:** MEDIUM - Business intelligence  

**Missing Metrics:**
- [ ] Jobs completed per technician
- [ ] Average time per job type
- [ ] Quality metrics (warranty claims)
- [ ] Revenue per technician
- [ ] Utilization rate

**Required Endpoints:**
```python
@app.get("/api/analytics/technician-performance")
@app.get("/api/analytics/technician/{user_id}/jobs")
@app.get("/api/analytics/technician/{user_id}/revenue")
```

---

### 2. Job Duration & Time Tracking
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No actual vs estimated time tracking  
**Impact:** MEDIUM - Process optimization  

**Missing Data:**
- [ ] Actual job duration calculation
- [ ] Time estimate accuracy tracking
- [ ] Bottleneck identification

**Required Schema:**
```python
# Job model additions:
estimated_hours: float
actual_hours: float  # calculated from laborLog
started_at: DateTime
completed_at: DateTime  # already exists
```

---

### 3. Parts Usage Analytics
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No parts consumption trends or usage analytics  
**Impact:** LOW - Inventory optimization  

**Missing Reports:**
- [ ] Most used parts
- [ ] Parts by job type
- [ ] Cost analysis per service type
- [ ] Stock turnover rate

---

### 4. Customer Lifetime Value (CLV) Analytics
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No customer value analysis  
**Impact:** LOW - Customer segmentation  

**Missing Metrics:**
- [ ] Total spend per customer
- [ ] Visit frequency
- [ ] Average transaction value
- [ ] Churn risk score

---

### 5. Invoice Aging Report
**Status:** ✅ IMPLEMENTED  
**Description:** Overdue invoice analysis showing payment arrears by age bucket
**Impact:** HIGH - Cash flow & collections management  
**Location:** `backend/api/main.py` (endpoint), `pages/InvoiceAging.tsx` (frontend)

**Implemented Features:**
- ✅ Backend endpoint: `GET /api/analytics/invoices/aging`
- ✅ Groups invoices by age: 0-30 days, 31-60 days, 61-90 days, 90+ days
- ✅ Shows total overdue amount and count
- ✅ Lists detailed overdue invoices with days overdue
- ✅ Company-scoped (multi-tenant isolation)
- ✅ Frontend page with detailed table and visual indicators
- ✅ Sortable by days overdue or amount
- ✅ Real-time report generation

**Response Model:**
```python
class InvoiceAgingReport(BaseModel):
    generated_at: datetime
    total_overdue_amount: float
    total_overdue_count: int
    age_groups: List[InvoiceAgeGroup]
    invoices: List[Dict[str, Any]]
```

**Frontend Features:**
- Summary cards showing total overdue amount and count
- Age group cards with color-coded urgency (0-30 days: yellow, 31-60: orange, 61-90: red, 90+: dark red)
- Detailed invoice table with customer name, invoice number, due date, days overdue, amount, status
- Sort buttons for days overdue and amount
- Refresh and export buttons

---

### 6. Financial Reports
**Status:** ⚠️ BASIC DASHBOARD, DETAILED REPORTS MISSING  
**Description:** Dashboard exists but no detailed financial reports  
**Impact:** MEDIUM - Business reporting  

**Missing Reports:**
- [ ] Profit & loss statement
- [ ] Tax summary report
- [x] Invoice aging report (IMPLEMENTED)
- [ ] Monthly revenue breakdown
- [ ] Cost analysis by service type

**Implemented Endpoint:**
```python
@app.get("/api/analytics/invoices/aging", response_model=InvoiceAgingReport, tags=["Analytics"])
async def get_invoice_aging_report(current_user: UserResponse = Depends(get_current_user))
```

**Remaining Endpoints:**
```python
@app.get("/api/analytics/financial/pl-statement")
@app.get("/api/analytics/financial/tax-summary")
@app.get("/api/analytics/financial/invoice-aging")
```

---

## Admin & User Management

### 1. User Invitation System
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No email-based user invitation workflow  
**Impact:** HIGH - Onboarding blocker  

**Missing Workflow:**
1. Admin initiates invitation
2. Email sent with signup link
3. Invitee creates account via link
4. Auto-assigned to company
5. Auto-assigned initial role

**Required Components:**
- [ ] Invitation table in database
- [ ] `/api/admin/users/invite` endpoint
- [ ] Email template with token link
- [ ] Invitation acceptance endpoint
- [ ] Invitation management UI
- [ ] Pending invitations list

**Database:**
```python
class UserInvitation(Base):
    __tablename__ = 'user_invitations'
    id = Column(String(36), primary_key=True)
    company_id = Column(String(36), ForeignKey('companies.id'), nullable=False)
    email = Column(String(200), unique=True)
    role = Column(String(20))  # default TECHNICIAN
    token = Column(String(255), unique=True)
    expires_at = Column(DateTime)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

### 2. Subscription Tier Enforcement
**Status:** ⚠️ SCHEMA EXISTS, NOT ENFORCED  
**Description:** Subscription fields in Company model but not validated  
**Impact:** MEDIUM - SaaS feature  

**Missing Validations:**
- [ ] Max users per tier
- [ ] Feature access restrictions
- [ ] Quota enforcement
- [ ] Tier upgrade/downgrade workflow
- [ ] Trial period management

**Required Endpoints:**
```python
@app.get("/api/admin/subscriptions/{company_id}")
@app.post("/api/admin/subscriptions/{company_id}/upgrade")
@app.post("/api/admin/subscriptions/{company_id}/cancel")
@app.get("/api/admin/subscriptions/{company_id}/usage")
```

**Business Logic Needed:**
```python
# Enforce in critical operations:
def check_user_quota(company_id: str) -> bool:
    """Verify company can add more users"""
    company = get_company(company_id)
    user_count = count_users_in_company(company_id)
    return user_count < company.subscription.max_users
```

---

### 3. System Admin Features
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Description:** Admin pages exist but limited functionality  
**Impact:** MEDIUM - System management  

**Missing Features:**
- [ ] View all companies (system admin)
- [ ] Company usage statistics
- [ ] Master admin dashboard
- [ ] System-wide reporting
- [ ] Mass operations (bulk user creation, etc.)

---

### 4. Audit Logging
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No action history or audit trail  
**Impact:** MEDIUM - Compliance/debugging  

**Required Table:**
```python
class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(String(36), primary_key=True)
    company_id = Column(String(36), ForeignKey('companies.id'))
    user_id = Column(String(36), ForeignKey('users.id'))
    action = Column(String(50))  # create, update, delete, etc.
    resource_type = Column(String(50))  # job, invoice, customer
    resource_id = Column(String(36))
    changes = Column(JSON)  # before/after values
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))
```

**Required Integration Points:**
- [ ] Log every Create/Update/Delete operation
- [ ] Track user login/logout
- [ ] Track permission changes
- [ ] Create audit log endpoint
- [ ] Create audit log UI page

---

## Data Persistence & Sync

### 1. In-Memory Store Persistence Issue
**Status:** ⚠️ DESIGN ISSUE  
**Description:** Primary store is in-memory; not persisted across restarts  
**Impact:** MEDIUM - Data loss risk  
**Location:** `services/store.ts`, `backend/api/main.py`

**Issues:**
- [ ] In-memory dictionaries lose data on restart
- [ ] Should validate against SQLite/PostgreSQL
- [ ] Unclear which is source of truth
- [ ] No sync between Firestore and in-memory

**Required Actions:**
- [ ] Make SQLite/PostgreSQL primary store
- [ ] Remove in-memory fallback or mark clearly
- [ ] Document data flow
- [ ] Implement background sync job

---

### 2. Offline Data Sync
**Status:** ⚠️ QUEUE EXISTS, INCOMPLETE  
**Description:** Offline queue system present but incomplete sync logic  
**Impact:** MEDIUM - Offline capability  
**Location:** `services/offlineQueue.ts`

**Missing Features:**
- [ ] Sync status UI indicator
- [ ] Conflict resolution strategy
- [ ] Retry backoff strategy
- [ ] Failed sync manual retry
- [ ] Sync progress indicator

---

### 3. Real-Time Sync
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No real-time data updates between users  
**Impact:** LOW - Initial scope (single user primary)  
**Required for Multi-User Features:**
- [ ] WebSocket implementation
- [ ] Firestore real-time listeners
- [ ] Optimistic updates
- [ ] Conflict resolution

---

## Testing & Quality Assurance

### 1. Backend Integration Tests Missing
**Status:** ⚠️ COMPANY TESTS EXIST, OTHERS MISSING  
**Description:** Only company enforcement tests; coverage gaps  
**Location:** `backend/tests/`

**Missing Test Suites:**
- [ ] Payment flow tests (PayFast integration mocking)
- [ ] Email/SMS sending tests
- [ ] Voice command parsing tests
- [ ] Appointment management tests
- [ ] Warranty lifecycle tests
- [ ] Parts inventory CRUD tests
- [ ] Multi-company isolation tests
- [ ] Authentication edge cases
- [ ] Rate limiting tests

**Test Coverage Needed:**
```python
# backend/tests/
test_payments.py          # PayFast integration
test_appointments.py      # Appointment CRUD + filtering
test_warranties.py        # Warranty management
test_labor.py            # Labor tracking
test_messaging.py        # Email/SMS triggers
test_authentication.py   # JWT, token refresh, expiry
test_multi_tenancy.py   # Data isolation enforcement
```

---

### 2. Frontend E2E Tests
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No end-to-end tests for user flows  
**Impact:** MEDIUM - Quality assurance  

**Missing Test Scenarios:**
- [ ] User login/signup flow
- [ ] Create job → Generate invoice → Mark paid
- [ ] Create quote → Convert to invoice
- [ ] Schedule appointment → Send notification
- [ ] View analytics with various date ranges
- [ ] Offline mode data sync

**Tools to Consider:**
- Playwright
- Cypress
- WebdriverIO

---

### 3. Load & Performance Testing
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No performance benchmarks or load tests  
**Impact:** LOW - MVP phase  

**Load Test Scenarios:**
- [ ] 100 concurrent users
- [ ] 10K jobs in database
- [ ] Large PDF generation
- [ ] Batch invoice operation
- [ ] Analytics query performance

---

### 4. Security Testing
**Status:** ⚠️ BASIC VALIDATION, PENETRATION TESTING NEEDED  
**Impact:** MEDIUM - Production readiness  

**Security Audit Gaps:**
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] CSRF protection validation
- [ ] JWT token security review
- [ ] Rate limiting effectiveness
- [ ] Permission bypass testing
- [ ] Data leakage testing

---

## Frontend UI/UX Features

### 1. Real-Time Notifications
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No toast/alert system for async operations  
**Impact:** LOW - UX enhancement  

**Missing Features:**
- [ ] Toast notification component
- [ ] Success/error/info/warning notifications
- [ ] Notification center/history
- [ ] Sound alerts for important events
- [ ] Browser push notifications

---

### 2. Bulk Operations
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No bulk edit/delete/action UI  
**Impact:** LOW - Operational efficiency  

**Missing Features:**
- [ ] Multi-select checkboxes
- [ ] Bulk delete confirmation
- [ ] Bulk status change
- [ ] Bulk email/SMS send
- [ ] Bulk invoice generation

---

### 3. Advanced Search & Filters
**Status:** ⚠️ BASIC SEARCH, ADVANCED MISSING  
**Description:** Simple search exists; advanced filters needed  
**Impact:** LOW - UX enhancement  

**Missing Filters:**
- [ ] Date range filter UI
- [ ] Multi-select filters
- [ ] Save custom filters
- [ ] Filter presets (e.g., "Overdue invoices")
- [ ] Full-text search
- [ ] Tag-based filtering

---

### 4. Data Export
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No CSV/Excel/PDF export functionality  
**Impact:** LOW - Operational feature  

**Missing Exports:**
- [ ] Export jobs to CSV
- [ ] Export customers to CSV
- [ ] Export invoices to Excel
- [ ] Export analytics to PDF
- [ ] Export with custom columns

**Implementation:**
```typescript
// Frontend utility needed:
export async function exportToCSV(data: any[], filename: string) {
  // Generate CSV from data array
}

export async function exportToExcel(data: any[], filename: string) {
  // Generate Excel from data array
}
```

---

### 5. Advanced Scheduling
**Status:** ⚠️ SCHEDULE PAGE EXISTS, LIMITED FUNCTIONALITY  
**Description:** Calendar view present but appointment features incomplete  
**Impact:** MEDIUM - Feature completeness  

**Missing Features:**
- [ ] Drag-and-drop appointment creation
- [ ] Appointment conflict detection
- [ ] Technician availability view
- [ ] Appointment templates/recurring
- [ ] Automatic scheduling recommendations
- [ ] Customer availability integration

---

### 6. Batch Invoice Operations
**Status:** ❌ NOT IMPLEMENTED  
**Description:** Single invoice generation only  
**Impact:** MEDIUM - Operational efficiency  

**Missing Features:**
- [ ] Generate invoices for multiple jobs at once
- [ ] Batch quote generation
- [ ] Batch email sending
- [ ] Batch PDF generation

---

### 7. Customer Portal
**Status:** ❌ NOT IMPLEMENTED  
**Description:** No customer-facing interface  
**Impact:** LOW - Future phase  

**Potential Features:**
- [ ] Job status tracking (customer view)
- [ ] Invoice viewing & download
- [ ] Quote acceptance
- [ ] Payment portal
- [ ] Appointment booking
- [ ] Service history

---

### 8. Mobile Responsiveness
**Status:** ⚠️ PARTIALLY RESPONSIVE  
**Description:** Not fully optimized for mobile  
**Impact:** LOW - Desktop-first approach  

**Mobile Issues:**
- [ ] Small screen navigation improvements
- [ ] Touch-friendly buttons
- [ ] Mobile-specific layouts
- [ ] Mobile input optimization
- [ ] Mobile app (PWA enhancement)

---

### 9. User Preferences & Customization
**Status:** ⚠️ BASIC THEME, MORE NEEDED  
**Description:** Dark mode exists; other customizations missing  
**Impact:** LOW - Enhancement  

**Missing Preferences:**
- [ ] Column visibility preferences
- [ ] Default view (list/grid)
- [ ] Default date format
- [ ] Currency/language settings
- [ ] Notification preferences
- [ ] Email frequency settings

---

## Summary by Priority

### 🔴 HIGH PRIORITY (Business Critical)
1. Parts inventory company scoping
2. PayFast payment integration & webhooks
3. User invitation system
4. Appointment CRUD endpoints
5. Email/SMS notification triggers

**Estimated Effort:** 3-4 weeks

---

### 🟡 MEDIUM PRIORITY (Feature Complete)
1. Labor tracking endpoints
2. Warranty management CRUD
3. Technician productivity reports
4. Invoice payment tracking
5. Subscription tier enforcement
6. Audit logging
7. Voice command processing
8. In-app notifications
9. Batch invoice operations

**Estimated Effort:** 4-6 weeks

---

### 🟢 LOW PRIORITY (Nice to Have)
1. Mileage records persistence
2. Job attachments full implementation
3. Advanced analytics dashboards
4. Customer lifetime value analytics
5. Data export (CSV/Excel)
6. Real-time sync features
7. Mobile app enhancements
8. Customer portal
9. Advanced search & filters

**Estimated Effort:** 3-4 weeks

---

## Legal & Compliance

### Not Addressed
- [ ] GDPR compliance
- [ ] Data retention policies
- [ ] PCI DSS for payment processing
- [ ] Backup & disaster recovery procedures
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie consent
- [ ] Data access logs (for compliance)

---

## Recommended Implementation Order

1. **Phase 1 (Weeks 1-2):** Payment processing + user invitations
2. **Phase 2 (Weeks 3-4):** Parts inventory + appointments
3. **Phase 3 (Weeks 5-6):** Notification triggers + labor tracking
4. **Phase 4 (Weeks 7-8):** Analytics + subscription enforcement
5. **Phase 5 (Weeks 9-10):** Testing + security audit
6. **Phase 6 (Ongoing):** Low-priority enhancements

---

## Document Maintenance

**Last Updated:** February 28, 2026  
**Next Review:** TBD  
**Owner:** Development Team  

For questions or updates to this document, please contact the development lead.
