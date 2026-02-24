
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  RECEPTIONIST = 'RECEPTIONIST'
}

export enum JobStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  AWAITING_PARTS = 'Awaiting Parts',
  AWAITING_APPROVAL = 'Awaiting Approval',
  INVOICED = 'Invoiced',
  PAID = 'Paid',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface MileageRecord {
  date: string;
  mileage: number;
  source: string; // e.g. 'Job Creation', 'Manual Update', 'Invoice'
  notes?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string; // MIME type
  fileSize: number; // bytes
  dataUrl: string; // Base64 string for preview/storage
  uploadedAt: string;
  uploadedBy: string;
  context?: string; // e.g. "Damage Report", "ID Document", "Invoice"
}

export interface Vehicle {
  id: string;
  ownerId: string;
  registration: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  mileage: number;
  mileageHistory: MileageRecord[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  consent: boolean; // POPIA/GDPR
  type?: 'Private' | 'Fleet' | 'Government';
  department?: string; // For government/fleet
  attachments?: Attachment[];
}

export interface Warranty {
  id: string;
  jobId: string;
  vehicleId: string;
  type: 'Parts' | 'Labor' | 'Full';
  startDate: string;
  endDate: string;
  description: string;
  status: 'Active' | 'Expired' | 'Void';
}

// Enhanced Job Structures
export interface JobTask {
  id: string;
  description: string;
  completed: boolean;
  notes?: string;
}

export interface JobPartUsage {
  id: string;
  partId: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface JobLabor {
  id: string;
  technicianId: string;
  technicianName: string;
  description: string;
  hours: number;
  ratePerHour: number;
  totalCost: number;
  date: string;
}

export interface JobLog {
  id: string;
  date: string;
  user: string;
  action: string; // e.g., "Status Changed", "Part Added", "Notification Sent"
  details: string;
}

export interface JobNotification {
  id: string;
  date: string;
  type: 'SMS' | 'EMAIL' | 'WHATSAPP';
  message: string;
  sentTo: string;
}

export interface Job {
  id: string;
  customerId: string;
  vehicleId: string;
  status: JobStatus;
  priority: Priority;
  serviceType: string;
  description: string;
  notes: string;
  estimatedCost: number;
  createdAt: string;
  dueDate: string;
  
  // Enhanced Arrays
  tasks: JobTask[];
  partsUsed: JobPartUsage[];
  laborLog: JobLabor[];
  activityLog: JobLog[];
  notifications: JobNotification[];
  warranties?: Warranty[];
  attachments?: Attachment[];
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minLevel: number;
  costPrice: number;
  sellingPrice: number;
  location: string;
  supplier: string;
}

export interface DiagnosticRecord {
  id: string;
  vehicleId: string;
  date: string;
  symptoms: string;
  dtcCodes: string[];
  aiAnalysis: string;
}

export interface Appointment {
  id: string;
  title: string;
  customerId: string;
  vehicleId: string;
  start: string; // ISO date string
  end: string; // ISO date string
  type: 'Service' | 'Inspection' | 'Repair';
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  notes?: string;
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  color?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  type: 'Invoice' | 'Quote'; // Distinguish between invoices and quotes
  jobId?: string;
  customerId: string;
  vehicleId?: string; // Allow linking to vehicle directly
  number: string;
  issueDate: string;
  dueDate: string; // Serves as Expiry Date for Quotes
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Accepted' | 'Rejected' | 'Converted';
  notes?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
