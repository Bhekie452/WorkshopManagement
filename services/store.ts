
import { 
  User, UserRole, Job, Customer, Vehicle, JobStatus, Priority, Part, 
  DiagnosticRecord, Appointment, Invoice, JobLog, JobNotification,
  Warranty, MileageRecord, Attachment 
} from '../types';
import { FirestoreService, Collections } from './firestore';

// Seed Data
const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@autoflow.com', role: UserRole.ADMIN, avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=random' },
  { id: '2', name: 'John Tech', email: 'tech@autoflow.com', role: UserRole.TECHNICIAN, avatar: 'https://ui-avatars.com/api/?name=John+Tech&background=random' },
];

const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Alice Johnson', email: 'alice@example.com', phone: '082 555 0101', address: '123 Maple St', consent: true, type: 'Private', attachments: [] },
  { id: 'c2', name: 'Bob Smith', email: 'bob@example.com', phone: '083 555 0102', address: '456 Oak Ave', consent: true, type: 'Private', attachments: [] },
  { id: 'c3', name: 'Charlie Davis', email: 'charlie@example.com', phone: '072 555 0103', address: '789 Pine Rd', consent: true, type: 'Private', attachments: [] },
  { id: 'c4', name: 'Dept of Transport', email: 'fleet@gov.za', phone: '012 555 9999', address: 'Pretoria Central', consent: true, type: 'Government', department: 'Logistics', attachments: [] },
  { id: 'c5', name: 'Swift Logistics', email: 'ops@swift.co.za', phone: '011 555 8888', address: 'Kempton Park', consent: true, type: 'Fleet', attachments: [] },
];

const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', ownerId: 'c1', registration: 'AB 123 CD', vin: '1HGCM82633A004352', make: 'Honda', model: 'Civic', year: 2018, color: 'Silver', fuelType: 'Petrol', mileage: 45000, mileageHistory: [{date: new Date().toISOString(), mileage: 45000, source: 'Initial Import'}] },
  { id: 'v2', ownerId: 'c2', registration: 'XY 987 ZW', vin: '5YJ3E1EA1JF000001', make: 'Tesla', model: 'Model 3', year: 2021, color: 'White', fuelType: 'Electric', mileage: 12000, mileageHistory: [{date: new Date().toISOString(), mileage: 12000, source: 'Initial Import'}] },
  { id: 'v3', ownerId: 'c3', registration: 'EF 456 GH', vin: 'WA1LAAGE6MD000002', make: 'Audi', model: 'e-tron', year: 2022, color: 'Blue', fuelType: 'Electric', mileage: 8000, mileageHistory: [{date: new Date().toISOString(), mileage: 8000, source: 'Initial Import'}] },
  { id: 'v4', ownerId: 'c4', registration: 'GV 001 GP', vin: '123GOV001', make: 'Toyota', model: 'Hilux', year: 2023, color: 'White', fuelType: 'Diesel', mileage: 15000, mileageHistory: [{date: new Date().toISOString(), mileage: 15000, source: 'Initial Import'}] },
  { id: 'v5', ownerId: 'c5', registration: 'SW 999 GP', vin: '999FLT888', make: 'Isuzu', model: 'D-Max', year: 2022, color: 'Red', fuelType: 'Diesel', mileage: 55000, mileageHistory: [{date: new Date().toISOString(), mileage: 55000, source: 'Initial Import'}] },
];

const MOCK_JOBS: Job[] = [
  { 
    id: 'JOB-8492', customerId: 'c1', vehicleId: 'v1', status: JobStatus.IN_PROGRESS, priority: Priority.MEDIUM, 
    serviceType: 'Regular Service', description: 'Oil change and brake check', notes: 'Customer mentioned squeaky brakes',
    estimatedCost: 2500, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), dueDate: new Date(Date.now() + 86400000).toISOString(),
    tasks: [{id: 't1', description: 'Drain Oil', completed: true}, {id: 't2', description: 'Replace Filter', completed: false}],
    partsUsed: [], laborLog: [], activityLog: [
      { id: 'l1', date: new Date(Date.now() - 86400000 * 2).toISOString(), user: 'Admin', action: 'Created', details: 'Job card created' }
    ], notifications: [], warranties: [], attachments: []
  },
  { 
    id: 'JOB-9921', customerId: 'c2', vehicleId: 'v2', status: JobStatus.PENDING, priority: Priority.HIGH, 
    serviceType: 'Diagnostics', description: 'Battery efficiency check', notes: '',
    estimatedCost: 1500, createdAt: new Date().toISOString(), dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    tasks: [{id: 't3', description: 'Run OBD Diagnostics', completed: false}],
    partsUsed: [], laborLog: [], activityLog: [], notifications: [], warranties: [], attachments: []
  },
  { 
    id: 'JOB-1023', customerId: 'c1', vehicleId: 'v1', status: JobStatus.COMPLETED, priority: Priority.LOW, 
    serviceType: 'Tire Rotation', description: 'Rotate all 4 tires', notes: 'Check tread depth',
    estimatedCost: 800, createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), dueDate: new Date(Date.now() - 86400000 * 9).toISOString(),
    tasks: [{id: 't4', description: 'Rotate Tires', completed: true}],
    partsUsed: [], laborLog: [], activityLog: [], notifications: [], warranties: [], attachments: []
  },
  { 
    id: 'JOB-5542', customerId: 'c3', vehicleId: 'v3', status: JobStatus.PAID, priority: Priority.MEDIUM, 
    serviceType: 'Software Update', description: 'System firmware update', notes: '',
    estimatedCost: 1200, createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), dueDate: new Date(Date.now() - 86400000 * 4).toISOString(),
    tasks: [{id: 't5', description: 'Flash Firmware', completed: true}],
    partsUsed: [], laborLog: [], activityLog: [], notifications: [], warranties: [], attachments: []
  },
];

const MOCK_PARTS: Part[] = [
  { id: 'p1', name: 'Oil Filter', sku: 'OF-2023', category: 'Filters', quantity: 15, minLevel: 5, costPrice: 50, sellingPrice: 120, location: 'A1-2', supplier: 'AutoParts Co' },
  { id: 'p2', name: 'Brake Pad Set', sku: 'BP-554', category: 'Brakes', quantity: 3, minLevel: 4, costPrice: 250, sellingPrice: 650, location: 'B2-1', supplier: 'BrakeMasters' },
  { id: 'p3', name: 'Synthetic Oil 5W-30', sku: 'OIL-5W30', category: 'Fluids', quantity: 20, minLevel: 10, costPrice: 150, sellingPrice: 350, location: 'C1-1', supplier: 'LubeTech' },
  { id: 'p4', name: 'Spark Plug', sku: 'SP-NGK', category: 'Ignition', quantity: 40, minLevel: 12, costPrice: 30, sellingPrice: 80, location: 'A2-3', supplier: 'Sparky Inc' },
  { id: 'p5', name: 'Cabin Air Filter', sku: 'CF-99', category: 'Filters', quantity: 2, minLevel: 5, costPrice: 80, sellingPrice: 220, location: 'A1-3', supplier: 'AutoParts Co' },
];

const MOCK_DIAGNOSTICS: DiagnosticRecord[] = [
  { id: 'd1', vehicleId: 'v1', date: new Date(Date.now() - 86400000 * 5).toISOString(), symptoms: 'Engine misfire', dtcCodes: ['P0300', 'P0301'], aiAnalysis: 'Likely spark plug or coil pack failure on cylinder 1.' }
];

const today = new Date();
const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'a1', title: 'Service - Honda Civic', customerId: 'c1', vehicleId: 'v1', start: new Date(today.setHours(9,0,0)).toISOString(), end: new Date(today.setHours(11,0,0)).toISOString(), type: 'Service', status: 'Scheduled', recurrence: 'None' },
  { id: 'a2', title: 'Inspection - Tesla Model 3', customerId: 'c2', vehicleId: 'v2', start: new Date(today.setHours(13,0,0)).toISOString(), end: new Date(today.setHours(14,0,0)).toISOString(), type: 'Inspection', status: 'Scheduled', recurrence: 'None' },
  { id: 'a3', title: 'Weekly Fleet Check', customerId: 'c5', vehicleId: 'v5', start: new Date(today.setHours(8,0,0)).toISOString(), end: new Date(today.setHours(9,0,0)).toISOString(), type: 'Inspection', status: 'Scheduled', recurrence: 'Weekly' },
];

const MOCK_INVOICES: Invoice[] = [
  { 
    id: 'INV-1001', type: 'Invoice', jobId: 'JOB-1023', customerId: 'c1', vehicleId: 'v1', number: 'INV-001', 
    issueDate: new Date(Date.now() - 86400000 * 9).toISOString(), dueDate: new Date(Date.now() + 86400000 * 20).toISOString(),
    items: [{ id: 'i1', description: 'Tire Rotation', quantity: 1, unitPrice: 800, total: 800 }],
    subtotal: 800, taxAmount: 120, total: 920, status: 'Paid'
  },
  { 
    id: 'QT-9001', type: 'Quote', customerId: 'c2', vehicleId: 'v2', number: 'QT-9001', 
    issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    items: [{ id: 'i2', description: 'Battery Replacement', quantity: 1, unitPrice: 15000, total: 15000 }],
    subtotal: 15000, taxAmount: 2250, total: 17250, status: 'Sent'
  }
];

// ==================== LOCAL CACHE HELPERS ====================
const get = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

const set = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==================== FIRESTORE PERSISTENCE (fire-and-forget) ====================
const firestoreSave = (collection: string, id: string, data: any) => {
  const { id: _id, ...docData } = data;
  FirestoreService.createWithId(collection, id, docData).catch(err => {
    console.warn(`[Store] Firestore write failed for ${collection}/${id}:`, err.message);
  });
};

const firestoreUpdate = (collection: string, id: string, data: any) => {
  const { id: _id, ...docData } = data;
  FirestoreService.update(collection, id, docData).catch(err => {
    console.warn(`[Store] Firestore update failed for ${collection}/${id}:`, err.message);
  });
};

const firestoreDelete = (collection: string, id: string) => {
  FirestoreService.delete(collection, id).catch(err => {
    console.warn(`[Store] Firestore delete failed for ${collection}/${id}:`, err.message);
  });
};

// ==================== INITIALIZATION ====================
let _initialized = false;

async function initializeStore(): Promise<void> {
  if (_initialized) return;
  console.log('[Store] Initializing — syncing from Firestore...');
  try {
    const [customers, vehicles, jobs, parts, appointments, invoices, diagnostics] = await Promise.all([
      FirestoreService.getAll<Customer>(Collections.CUSTOMERS).catch(() => [] as Customer[]),
      FirestoreService.getAll<Vehicle>(Collections.VEHICLES).catch(() => [] as Vehicle[]),
      FirestoreService.getAll<Job>(Collections.JOBS).catch(() => [] as Job[]),
      FirestoreService.getAll<Part>(Collections.PARTS).catch(() => [] as Part[]),
      FirestoreService.getAll<Appointment>(Collections.APPOINTMENTS).catch(() => [] as Appointment[]),
      FirestoreService.getAll<Invoice>(Collections.INVOICES).catch(() => [] as Invoice[]),
      FirestoreService.getAll<DiagnosticRecord>(Collections.DIAGNOSTICS).catch(() => [] as DiagnosticRecord[]),
    ]);

    const seedIfEmpty = <T extends { id: string }>(items: T[], fallback: T[], cacheKey: string, collection: string) => {
      if (items.length > 0) {
        set(cacheKey, items);
      } else {
        set(cacheKey, fallback);
        fallback.forEach(item => firestoreSave(collection, item.id, item));
      }
    };

    seedIfEmpty(customers, MOCK_CUSTOMERS, 'customers', Collections.CUSTOMERS);
    seedIfEmpty(vehicles, MOCK_VEHICLES, 'vehicles', Collections.VEHICLES);
    seedIfEmpty(jobs, MOCK_JOBS, 'jobs', Collections.JOBS);
    seedIfEmpty(parts, MOCK_PARTS, 'parts', Collections.PARTS);
    seedIfEmpty(appointments, MOCK_APPOINTMENTS, 'appointments', Collections.APPOINTMENTS);
    seedIfEmpty(invoices, MOCK_INVOICES, 'invoices', Collections.INVOICES);
    seedIfEmpty(diagnostics, MOCK_DIAGNOSTICS, 'diagnostics', Collections.DIAGNOSTICS);

    _initialized = true;
    console.log('[Store] Firestore sync complete ✓');
  } catch (error) {
    console.warn('[Store] Firestore init failed, using localStorage cache:', error);
    _initialized = true;
  }
}

// ==================== STORE (sync reads, Firestore-backed writes) ====================
export const store = {
  init: initializeStore,
  isInitialized: () => _initialized,

  // ==================== USERS ====================
  getUsers: () => MOCK_USERS,
  
  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : MOCK_USERS[0];
  },
  
  setCurrentUser: (user: User) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
  },

  // ==================== CUSTOMERS ====================
  getCustomers: () => get<Customer[]>('customers', MOCK_CUSTOMERS),
  
  addCustomer: (c: Customer) => {
    const list = get<Customer[]>('customers', MOCK_CUSTOMERS);
    const newItem = { ...c, id: c.id || Math.random().toString(36).substr(2, 9), attachments: c.attachments || [] };
    set('customers', [...list, newItem]);
    firestoreSave(Collections.CUSTOMERS, newItem.id, newItem);
    return newItem;
  },
  
  updateCustomer: (id: string, data: Partial<Customer>) => {
    const list = get<Customer[]>('customers', MOCK_CUSTOMERS);
    const index = list.findIndex(c => c.id === id);
    if (index > -1) {
      list[index] = { ...list[index], ...data };
      set('customers', list);
      firestoreUpdate(Collections.CUSTOMERS, id, data);
    }
  },
  
  deleteCustomer: (id: string) => {
    const list = get<Customer[]>('customers', MOCK_CUSTOMERS);
    set('customers', list.filter(c => c.id !== id));
    firestoreDelete(Collections.CUSTOMERS, id);
  },
  
  addCustomerAttachment: (customerId: string, attachment: Attachment) => {
    const list = get<Customer[]>('customers', MOCK_CUSTOMERS);
    const index = list.findIndex(c => c.id === customerId);
    if(index > -1) {
      const c = list[index];
      c.attachments = [attachment, ...(c.attachments || [])];
      list[index] = c;
      set('customers', list);
      firestoreUpdate(Collections.CUSTOMERS, customerId, { attachments: c.attachments });
    }
  },

  // ==================== VEHICLES ====================
  getVehicles: () => {
    const vehicles = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    return vehicles.map(v => ({...v, mileageHistory: v.mileageHistory || [] }));
  },
  
  getVehiclesByOwner: (ownerId: string) => {
    const vehicles = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    return vehicles.filter(v => v.ownerId === ownerId);
  },
  
  addVehicle: (v: Vehicle) => {
    const list = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    const newItem = { 
      ...v, 
      id: Math.random().toString(36).substr(2, 9),
      mileageHistory: v.mileageHistory || [{date: new Date().toISOString(), mileage: v.mileage, source: 'Initial Import'}] 
    };
    set('vehicles', [...list, newItem]);
    firestoreSave(Collections.VEHICLES, newItem.id, newItem);
    return newItem;
  },
  
  updateVehicle: (id: string, data: Partial<Vehicle>) => {
    const list = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    const index = list.findIndex(v => v.id === id);
    if (index > -1) {
      list[index] = { ...list[index], ...data };
      set('vehicles', list);
      firestoreUpdate(Collections.VEHICLES, id, data);
    }
  },
  
  updateVehicleMileage: (vehicleId: string, newMileage: number, source: string) => {
    const list = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    const index = list.findIndex(v => v.id === vehicleId);
    if(index > -1) {
      const v = list[index];
      const history = v.mileageHistory || [];
      const newEntry: MileageRecord = {
        date: new Date().toISOString(),
        mileage: newMileage,
        source: source
      };
      const updatedData = { mileage: newMileage, mileageHistory: [newEntry, ...history] };
      list[index] = { ...v, ...updatedData };
      set('vehicles', list);
      firestoreUpdate(Collections.VEHICLES, vehicleId, updatedData);
    }
  },

  deleteVehicle: (id: string) => {
    const list = get<Vehicle[]>('vehicles', MOCK_VEHICLES);
    set('vehicles', list.filter(v => v.id !== id));
    firestoreDelete(Collections.VEHICLES, id);
  },

  // ==================== JOBS ====================
  getJobs: () => get<Job[]>('jobs', MOCK_JOBS),
  
  getJobById: (id: string): Job | undefined => {
    const jobs = get<Job[]>('jobs', MOCK_JOBS);
    return jobs.find(j => j.id === id);
  },
  
  addJob: (j: Job) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    const newItem = { 
      ...j, 
      id: `JOB-${Math.floor(Math.random() * 10000)}`,
      tasks: j.tasks || [],
      partsUsed: [],
      laborLog: [],
      activityLog: [{ id: Date.now().toString(), date: new Date().toISOString(), user: 'Current User', action: 'Created', details: 'Job card created' }],
      notifications: [],
      warranties: [],
      attachments: []
    };
    set('jobs', [newItem, ...list]);
    firestoreSave(Collections.JOBS, newItem.id, newItem);
    return newItem;
  },
  
  updateJob: (idOrJob: string | Job, data?: Partial<Job>) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    
    // Handle both old signature (full job object) and new signature (id, partial data)
    let id: string;
    let updateData: Partial<Job>;
    
    if (typeof idOrJob === 'string') {
      // New signature: updateJob(id, { field: value })
      id = idOrJob;
      updateData = data || {};
    } else {
      // Old signature: updateJob(fullJobObject)
      // Preserve the id and use the full object as update data
      id = idOrJob.id;
      // If explicit data was provided as second arg, merge it; otherwise use the job object
      updateData = data ? { ...idOrJob, ...data } : idOrJob;
    }
    
    const index = list.findIndex(j => j.id === id);
    if (index > -1) {
      list[index] = { ...list[index], ...updateData };
      set('jobs', list);
      firestoreUpdate(Collections.JOBS, id, updateData);
    }
  },

  deleteJob: (id: string) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    set('jobs', list.filter(j => j.id !== id));
    firestoreDelete(Collections.JOBS, id);
  },
  
  // Job Activity
  addJobLog: (jobId: string, action: string, details: string) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    const jobIndex = list.findIndex(j => j.id === jobId);
    if (jobIndex > -1) {
      const newLog: JobLog = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        user: 'Current User',
        action,
        details
      };
      list[jobIndex].activityLog = [newLog, ...list[jobIndex].activityLog];
      set('jobs', list);
      firestoreUpdate(Collections.JOBS, jobId, { activityLog: list[jobIndex].activityLog });
    }
  },

  logNotification: (jobId: string, type: 'SMS' | 'EMAIL' | 'WHATSAPP', message: string, sentTo: string) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    const jobIndex = list.findIndex(j => j.id === jobId);
    if (jobIndex > -1) {
      const newNotif: JobNotification = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type,
        message,
        sentTo
      };
      list[jobIndex].notifications = [newNotif, ...list[jobIndex].notifications];
      set('jobs', list);
      firestoreUpdate(Collections.JOBS, jobId, { notifications: list[jobIndex].notifications });
    }
  },

  addWarranty: (w: Warranty) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    const jobIndex = list.findIndex(j => j.id === w.jobId);
    if (jobIndex > -1) {
      const job = list[jobIndex];
      job.warranties = [...(job.warranties || []), w];
      list[jobIndex] = job;
      set('jobs', list);
      firestoreUpdate(Collections.JOBS, w.jobId, { warranties: job.warranties });
    }
  },

  addJobAttachment: (jobId: string, attachment: Attachment) => {
    const list = get<Job[]>('jobs', MOCK_JOBS);
    const jobIndex = list.findIndex(j => j.id === jobId);
    if (jobIndex > -1) {
      const job = list[jobIndex];
      job.attachments = [attachment, ...(job.attachments || [])];
      list[jobIndex] = job;
      set('jobs', list);
      firestoreUpdate(Collections.JOBS, jobId, { attachments: job.attachments });
    }
  },

  // ==================== PARTS/INVENTORY ====================
  getParts: () => get<Part[]>('parts', MOCK_PARTS),
  
  addPart: (p: Part) => {
    const list = get<Part[]>('parts', MOCK_PARTS);
    const newItem = { ...p, id: `PART-${Math.floor(Math.random() * 10000)}` };
    set('parts', [...list, newItem]);
    firestoreSave(Collections.PARTS, newItem.id, newItem);
    return newItem;
  },
  
  updatePart: (updatedPart: Part) => {
    const list = get<Part[]>('parts', MOCK_PARTS);
    const newList = list.map(p => p.id === updatedPart.id ? updatedPart : p);
    set('parts', newList);
    firestoreUpdate(Collections.PARTS, updatedPart.id, updatedPart);
  },

  deletePart: (id: string) => {
    const list = get<Part[]>('parts', MOCK_PARTS);
    set('parts', list.filter(p => p.id !== id));
    firestoreDelete(Collections.PARTS, id);
  },

  // ==================== DIAGNOSTICS ====================
  getDiagnostics: () => get<DiagnosticRecord[]>('diagnostics', MOCK_DIAGNOSTICS),
  
  addDiagnostic: (d: DiagnosticRecord) => {
    const list = get<DiagnosticRecord[]>('diagnostics', MOCK_DIAGNOSTICS);
    const newItem = { ...d, id: `DIAG-${Math.floor(Math.random() * 10000)}` };
    set('diagnostics', [newItem, ...list]);
    firestoreSave(Collections.DIAGNOSTICS, newItem.id, newItem);
    return newItem;
  },

  deleteDiagnostic: (id: string) => {
    const list = get<DiagnosticRecord[]>('diagnostics', MOCK_DIAGNOSTICS);
    set('diagnostics', list.filter(d => d.id !== id));
    firestoreDelete(Collections.DIAGNOSTICS, id);
  },

  // ==================== APPOINTMENTS ====================
  getAppointments: () => get<Appointment[]>('appointments', MOCK_APPOINTMENTS),
  
  addAppointment: (a: Appointment) => {
    const list = get<Appointment[]>('appointments', MOCK_APPOINTMENTS);
    const newItem = { ...a, id: `APT-${Math.floor(Math.random() * 10000)}` };
    set('appointments', [...list, newItem]);
    firestoreSave(Collections.APPOINTMENTS, newItem.id, newItem);
    return newItem;
  },

  updateAppointment: (id: string, data: Partial<Appointment>) => {
    const list = get<Appointment[]>('appointments', MOCK_APPOINTMENTS);
    const index = list.findIndex(a => a.id === id);
    if (index > -1) {
      list[index] = { ...list[index], ...data };
      set('appointments', list);
      firestoreUpdate(Collections.APPOINTMENTS, id, data);
    }
  },

  deleteAppointment: (id: string) => {
    const list = get<Appointment[]>('appointments', MOCK_APPOINTMENTS);
    set('appointments', list.filter(a => a.id !== id));
    firestoreDelete(Collections.APPOINTMENTS, id);
  },

  // ==================== INVOICES ====================
  getInvoices: () => get<Invoice[]>('invoices', MOCK_INVOICES),
  
  addInvoice: (i: Invoice) => {
    const list = get<Invoice[]>('invoices', MOCK_INVOICES);
    const newItem = { 
      ...i, 
      id: i.id || (i.type === 'Quote' ? `QT-${Math.floor(Math.random() * 10000)}` : `INV-${Math.floor(Math.random() * 10000)}`) 
    };
    set('invoices', [newItem, ...list]);
    firestoreSave(Collections.INVOICES, newItem.id, newItem);
    return newItem;
  },
  
  updateInvoice: (id: string, data: Partial<Invoice>) => {
    const list = get<Invoice[]>('invoices', MOCK_INVOICES);
    const index = list.findIndex(i => i.id === id);
    if (index > -1) {
      list[index] = { ...list[index], ...data };
      set('invoices', list);
      firestoreUpdate(Collections.INVOICES, id, data);
    }
  },

  deleteInvoice: (id: string) => {
    const list = get<Invoice[]>('invoices', MOCK_INVOICES);
    set('invoices', list.filter(i => i.id !== id));
    firestoreDelete(Collections.INVOICES, id);
  },

  // ==================== FILE UPLOAD HELPER ====================
  convertFileToBase64: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  },

  // ==================== UTILITIES ====================
  reset: () => {
    localStorage.clear();
    window.location.reload();
  }
};

// Export async version that wraps localStorage (for future Firebase migration)
export const storeAsync = {
  getCustomers: async () => store.getCustomers(),
  getVehicles: async () => store.getVehicles(),
  getJobs: async () => store.getJobs(),
  getParts: async () => store.getParts(),
  getDiagnostics: async () => store.getDiagnostics(),
  getAppointments: async () => store.getAppointments(),
  getInvoices: async () => store.getInvoices(),
};
