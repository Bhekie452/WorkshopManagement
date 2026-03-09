export interface EvBattery {
  id: string;
  vehicleId: string;
  soh: number; // State of Health (%)
  soc: number; // State of Charge (%)
  estimatedRangeKm: number;
  status: 'Excellent' | 'Good' | 'Fair' | 'Critical';
  rulMonths: number;
  confidence: number;
  nextMaintenanceDate: string;
  maintenanceReason: string;
  needsAttention: boolean;
  cells: Array<{ cell: string; voltage: number }>;
  createdAt: string;
}

export interface EvBatteryTelemetry {
  current_soh: number;
  cycle_count: number;
  avg_temperature: number;
  fast_charge_ratio: number;
  age_months: number;
  avg_dod: number;
  capacity_kwh: number;
  ambient_temp_avg: number;
}

export interface BatteryHealthResponse {
  current: EvBattery | null;
  history: EvBattery[];
}

export interface BatteryHealthLog {
  id: string;
  vehicleId: string;
  soh: number;
  soc: number;
  timestamp: string;
  cells: Array<{ cell: string; voltage: number }>;
}
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
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
  phone?: string;
  bio?: string;
  role: UserRole;
  avatar?: string;
  companyId?: string;
  permissions?: string[];
  createdAt?: string;
  lastLogin?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  logo?: string;
  industry?: string;
  subscription?: 'free' | 'basic' | 'premium' | 'enterprise';
  maxUsers?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  module?: string;
  category?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color?: string;
  isSystem?: boolean;
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
  companyId?: string; // owned by which company
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

export type ContactChannel = 'email' | 'phone' | 'both';

export interface Customer {
  id: string;
  companyId?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  consent: boolean; // POPIA/GDPR
  preferredContact?: ContactChannel; // How customer prefers to be reached
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
  companyId?: string;
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
  startedAt?: string;
  completedAt?: string;  // actual completion timestamp
  estimatedHours: number;
  actualHours: number;
  timeVariance: number;
  
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
  batteryTelemetry?: EvBatteryTelemetry;
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
  id:string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  companyId?: string;
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

export interface CompanyProfile {
  id: string;
  name: string;
  tagline?: string;
  registrationNumber?: string;
  vatNumber?: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    alternativePhone?: string;
    email: string;
    website?: string;
  };
  banking: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
  };
  operatingHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  logo?: string;
  defaultTaxRate: number;
  defaultPaymentTerms: number; // days
  invoicePrefix: string;
  quotePrefix: string;
  createdAt: string;
  updatedAt: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  inApp: boolean;
  events: {
    jobUpdates: boolean;
    inventoryAlerts: boolean;
    customerMessages: boolean;
    systemAlerts: boolean;
  };
}

export interface UserPreferences {
  defaultView: 'list' | 'grid';
  dateFormat: 'short' | 'medium' | 'long' | 'iso';
  currency: string;
  currencySymbol: string;
  columnVisibility: Record<string, string[]>;
  emailFrequency: 'daily' | 'weekly' | 'instant' | 'none';
}

// --- Analytics Types ---
export interface TechnicianPerformance {
  technicianId: string;
  technicianName: string;
  jobsCompleted: number;
  avgTimePerJob: number;
  revenueGenerated: number;
  utilizationRate: number;
  qualityScore: number;
  warrantyClaims: number;
}

export interface TechnicianJobAnalytics {
  jobId: string;
  jobNumber: string;
  serviceType: string;
  status: string;
  hoursLogged: number;
  revenue: number;
  completedAt?: string;
}

export interface TechnicianRevenueAnalytics {
  technicianId: string;
  totalRevenue: number;
  laborRevenue: number;
  partsRevenue: number;
  period: string;
}

export interface TimeAccuracyMetric {
  serviceType: string;
  avgEstimatedHours: number;
  avgActualHours: number;
  avgVariance: number;
  accuracyPercentage: number;
  jobCount: number;
}

export interface TimeTrackingAnalytics {
  overallAccuracy: number;
  metricsByService: TimeAccuracyMetric[];
  topBottlenecks: any[];
}
