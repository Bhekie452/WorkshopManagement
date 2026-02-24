/**
 * Firestore-enabled Store Service
 * 
 * This migrates from localStorage to Firebase Firestore while maintaining
 * localStorage as fallback during development/testing.
 * 
 * Migration Strategy:
 * 1. Try Firestore first
 * 2. Fall back to localStorage if offline or error
 * 3. All methods now return Promises
 */

import {
    User, UserRole, Job, Customer, Vehicle, JobStatus, Priority, Part,
    DiagnosticRecord, Appointment, Invoice, JobLog, JobNotification,
    Warranty, MileageRecord, Attachment
} from '../types';
import { FirestoreService, Collections } from './firestore';
import { where, orderBy } from 'firebase/firestore';

// Import existing mock data for fallback
const MOCK_USERS: User[] = [
    { id: '1', name: 'Admin User', email: 'admin@autoflow.com', role: UserRole.ADMIN, avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=random' },
    { id: '2', name: 'John Tech', email: 'tech@autoflow.com', role: UserRole.TECHNICIAN, avatar: 'https://ui-avatars.com/api/?name=John+Tech&background=random' },
];

// Use environment variable to toggle between Firestore and localStorage
const USE_FIRESTORE = true; // Set to false to use localStorage only

// LocalStorage Helper Functions
const getFromLocalStorage = <T>(key: string, initial: T): T => {
    const stored = localStorage.getItem(key);
    if (!stored) {
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
    }
    return JSON.parse(stored);
};

const setToLocalStorage = <T>(key: string, data: T) => {
    localStorage.setItem(key, JSON.stringify(data));
};

/**
 * New Async Store Service
 * All methods return Promises to support Firestore async operations
 */
export const storeV2 = {

    // ==================== USERS ====================

    async getUsers(): Promise<User[]> {
        if (!USE_FIRESTORE) return Promise.resolve(MOCK_USERS);

        try {
            const users = await FirestoreService.getAll<User>(Collections.USERS);
            return users.length > 0 ? users : MOCK_USERS;
        } catch (error) {
            console.error('Error fetching users from Firestore, using mock data:', error);
            return MOCK_USERS;
        }
    },

    async getUserById(id: string): Promise<User | null> {
        if (!USE_FIRESTORE) {
            const user = MOCK_USERS.find(u => u.id === id);
            return Promise.resolve(user || null);
        }

        try {
            return await FirestoreService.getById<User>(Collections.USERS, id);
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    },

    // ==================== CUSTOMERS ====================

    async getCustomers(): Promise<Customer[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Customer[]>('customers', []));
        }

        try {
            return await FirestoreService.getAll<Customer>(Collections.CUSTOMERS);
        } catch (error) {
            console.error('Error fetching customers:', error);
            return getFromLocalStorage<Customer[]>('customers', []);
        }
    },

    async addCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
        const newCustomer = { ...customer, attachments: customer.attachments || [] };

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Customer[]>('customers', []);
            const created = { ...newCustomer, id: Math.random().toString(36).substr(2, 9) } as Customer;
            setToLocalStorage('customers', [...list, created]);
            return Promise.resolve(created);
        }

        try {
            const id = await FirestoreService.create(Collections.CUSTOMERS, newCustomer);
            return { id, ...newCustomer } as Customer;
        } catch (error) {
            console.error('Error adding customer:', error);
            throw error;
        }
    },

    async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Customer[]>('customers', []);
            const index = list.findIndex(c => c.id === id);
            if (index > -1) {
                list[index] = { ...list[index], ...data };
                setToLocalStorage('customers', list);
            }
            return Promise.resolve();
        }

        try {
            await FirestoreService.update(Collections.CUSTOMERS, id, data);
        } catch (error) {
            console.error('Error updating customer:', error);
            throw error;
        }
    },

    async deleteCustomer(id: string): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Customer[]>('customers', []);
            setToLocalStorage('customers', list.filter(c => c.id !== id));
            return Promise.resolve();
        }

        try {
            await FirestoreService.delete(Collections.CUSTOMERS, id);
        } catch (error) {
            console.error('Error deleting customer:', error);
            throw error;
        }
    },

    // ==================== VEHICLES ====================

    async getVehicles(): Promise<Vehicle[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Vehicle[]>('vehicles', []));
        }

        try {
            return await FirestoreService.getAll<Vehicle>(Collections.VEHICLES);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
            return getFromLocalStorage<Vehicle[]>('vehicles', []);
        }
    },

    async getVehiclesByOwner(ownerId: string): Promise<Vehicle[]> {
        if (!USE_FIRESTORE) {
            const vehicles = getFromLocalStorage<Vehicle[]>('vehicles', []);
            return Promise.resolve(vehicles.filter(v => v.ownerId === ownerId));
        }

        try {
            return await FirestoreService.queryDocuments<Vehicle>(
                Collections.VEHICLES,
                where('ownerId', '==', ownerId)
            );
        } catch (error) {
            console.error('Error fetching vehicles by owner:', error);
            return [];
        }
    },

    async addVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
        const newVehicle = {
            ...vehicle,
            mileageHistory: vehicle.mileageHistory || [
                { date: new Date().toISOString(), mileage: vehicle.mileage, source: 'Initial Import' }
            ]
        };

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Vehicle[]>('vehicles', []);
            const created = { ...newVehicle, id: Math.random().toString(36).substr(2, 9) } as Vehicle;
            setToLocalStorage('vehicles', [...list, created]);
            return Promise.resolve(created);
        }

        try {
            const id = await FirestoreService.create(Collections.VEHICLES, newVehicle);
            return { id, ...newVehicle } as Vehicle;
        } catch (error) {
            console.error('Error adding vehicle:', error);
            throw error;
        }
    },

    async updateVehicle(id: string, data: Partial<Vehicle>): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Vehicle[]>('vehicles', []);
            const index = list.findIndex(v => v.id === id);
            if (index > -1) {
                list[index] = { ...list[index], ...data };
                setToLocalStorage('vehicles', list);
            }
            return Promise.resolve();
        }

        try {
            await FirestoreService.update(Collections.VEHICLES, id, data);
        } catch (error) {
            console.error('Error updating vehicle:', error);
            throw error;
        }
    },

    async updateVehicleMileage(vehicleId: string, newMileage: number, source: string): Promise<void> {
        const vehicle = await (async () => {
            if (!USE_FIRESTORE) {
                const list = getFromLocalStorage<Vehicle[]>('vehicles', []);
                return list.find(v => v.id === vehicleId);
            }
            return await FirestoreService.getById<Vehicle>(Collections.VEHICLES, vehicleId);
        })();

        if (!vehicle) return;

        const newEntry: MileageRecord = {
            date: new Date().toISOString(),
            mileage: newMileage,
            source
        };

        const updatedData = {
            mileage: newMileage,
            mileageHistory: [newEntry, ...(vehicle.mileageHistory || [])]
        };

        await this.updateVehicle(vehicleId, updatedData);
    },

    // ==================== JOBS ====================

    async getJobs(): Promise<Job[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Job[]>('jobs', []));
        }

        try {
            return await FirestoreService.getAll<Job>(
                Collections.JOBS,
                orderBy('createdAt', 'desc')
            );
        } catch (error) {
            console.error('Error fetching jobs:', error);
            return getFromLocalStorage<Job[]>('jobs', []);
        }
    },

    async getJobById(id: string): Promise<Job | null> {
        if (!USE_FIRESTORE) {
            const jobs = getFromLocalStorage<Job[]>('jobs', []);
            return Promise.resolve(jobs.find(j => j.id === id) || null);
        }

        try {
            return await FirestoreService.getById<Job>(Collections.JOBS, id);
        } catch (error) {
            console.error('Error fetching job:', error);
            return null;
        }
    },

    async addJob(job: Omit<Job, 'id'>): Promise<Job> {
        const newJob = {
            ...job,
            tasks: job.tasks || [],
            partsUsed: [],
            laborLog: [],
            activityLog: [{
                id: Date.now().toString(),
                date: new Date().toISOString(),
                user: 'Current User',
                action: 'Created',
                details: 'Job card created'
            }],
            notifications: [],
            warranties: [],
            attachments: []
        };

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Job[]>('jobs', []);
            const created = { ...newJob, id: `JOB-${Math.floor(Math.random() * 10000)}` } as Job;
            setToLocalStorage('jobs', [created, ...list]);
            return Promise.resolve(created);
        }

        try {
            const id = await FirestoreService.create(Collections.JOBS, newJob);
            return { id, ...newJob } as Job;
        } catch (error) {
            console.error('Error adding job:', error);
            throw error;
        }
    },

    async updateJob(id: string, data: Partial<Job>): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Job[]>('jobs', []);
            const index = list.findIndex(j => j.id === id);
            if (index > -1) {
                list[index] = { ...list[index], ...data };
                setToLocalStorage('jobs', list);
            }
            return Promise.resolve();
        }

        try {
            await FirestoreService.update(Collections.JOBS, id, data);
        } catch (error) {
            console.error('Error updating job:', error);
            throw error;
        }
    },

    async addJobLog(jobId: string, action: string, details: string): Promise<void> {
        const job = await this.getJobById(jobId);
        if (!job) return;

        const newLog: JobLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            user: 'Current User',
            action,
            details
        };

        await this.updateJob(jobId, {
            activityLog: [newLog, ...job.activityLog]
        });
    },

    // ==================== PARTS/INVENTORY ====================

    async getParts(): Promise<Part[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Part[]>('parts', []));
        }

        try {
            return await FirestoreService.getAll<Part>(Collections.PARTS);
        } catch (error) {
            console.error('Error fetching parts:', error);
            return getFromLocalStorage<Part[]>('parts', []);
        }
    },

    async addPart(part: Omit<Part, 'id'>): Promise<Part> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Part[]>('parts', []);
            const created = { ...part, id: `PART-${Math.floor(Math.random() * 10000)}` } as Part;
            setToLocalStorage('parts', [...list, created]);
            return Promise.resolve(created);
        }

        try {
            const id = await FirestoreService.create(Collections.PARTS, part);
            return { id, ...part } as Part;
        } catch (error) {
            console.error('Error adding part:', error);
            throw error;
        }
    },

    async updatePart(id: string, data: Partial<Part>): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Part[]>('parts', []);
            const index = list.findIndex(p => p.id === id);
            if (index > -1) {
                list[index] = { ...list[index], ...data };
                setToLocalStorage('parts', list);
            }
            return Promise.resolve();
        }

        try {
            await FirestoreService.update(Collections.PARTS, id, data);
        } catch (error) {
            console.error('Error updating part:', error);
            throw error;
        }
    },

    // ==================== INVOICES ====================

    async getInvoices(): Promise<Invoice[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Invoice[]>('invoices', []));
        }

        try {
            return await FirestoreService.getAll<Invoice>(
                Collections.INVOICES,
                orderBy('issueDate', 'desc')
            );
        } catch (error) {
            console.error('Error fetching invoices:', error);
            return getFromLocalStorage<Invoice[]>('invoices', []);
        }
    },

    async addInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
        const id = invoice.type === 'Quote'
            ? `QT-${Math.floor(Math.random() * 10000)}`
            : `INV-${Math.floor(Math.random() * 10000)}`;

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Invoice[]>('invoices', []);
            const created = { ...invoice, id } as Invoice;
            setToLocalStorage('invoices', [created, ...list]);
            return Promise.resolve(created);
        }

        try {
            await FirestoreService.create(Collections.INVOICES, { ...invoice, id });
            return { id, ...invoice } as Invoice;
        } catch (error) {
            console.error('Error adding invoice:', error);
            throw error;
        }
    },

    async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Invoice[]>('invoices', []);
            const index = list.findIndex(i => i.id === id);
            if (index > -1) {
                list[index] = { ...list[index], ...data };
                setToLocalStorage('invoices', list);
            }
            return Promise.resolve();
        }

        try {
            await FirestoreService.update(Collections.INVOICES, id, data);
        } catch (error) {
            console.error('Error updating invoice:', error);
            throw error;
        }
    },

    // ==================== APPOINTMENTS ====================

    async getAppointments(): Promise<Appointment[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<Appointment[]>('appointments', []));
        }

        try {
            return await FirestoreService.getAll<Appointment>(
                Collections.APPOINTMENTS,
                orderBy('start', 'asc')
            );
        } catch (error) {
            console.error('Error fetching appointments:', error);
            return getFromLocalStorage<Appointment[]>('appointments', []);
        }
    },

    async addAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
        const id = `APT-${Math.floor(Math.random() * 10000)}`;

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<Appointment[]>('appointments', []);
            const created = { ...appointment, id } as Appointment;
            setToLocalStorage('appointments', [...list, created]);
            return Promise.resolve(created);
        }

        try {
            await FirestoreService.create(Collections.APPOINTMENTS, { ...appointment, id });
            return { id, ...appointment } as Appointment;
        } catch (error) {
            console.error('Error adding appointment:', error);
            throw error;
        }
    },

    // ==================== DIAGNOSTICS ====================

    async getDiagnostics(): Promise<DiagnosticRecord[]> {
        if (!USE_FIRESTORE) {
            return Promise.resolve(getFromLocalStorage<DiagnosticRecord[]>('diagnostics', []));
        }

        try {
            return await FirestoreService.getAll<DiagnosticRecord>(
                Collections.DIAGNOSTICS,
                orderBy('date', 'desc')
            );
        } catch (error) {
            console.error('Error fetching diagnostics:', error);
            return getFromLocalStorage<DiagnosticRecord[]>('diagnostics', []);
        }
    },

    async addDiagnostic(diagnostic: Omit<DiagnosticRecord, 'id'>): Promise<DiagnosticRecord> {
        const id = `DIAG-${Math.floor(Math.random() * 10000)}`;

        if (!USE_FIRESTORE) {
            const list = getFromLocalStorage<DiagnosticRecord[]>('diagnostics', []);
            const created = { ...diagnostic, id } as DiagnosticRecord;
            setToLocalStorage('diagnostics', [created, ...list]);
            return Promise.resolve(created);
        }

        try {
            await FirestoreService.create(Collections.DIAGNOSTICS, { ...diagnostic, id });
            return { id, ...diagnostic } as DiagnosticRecord;
        } catch (error) {
            console.error('Error adding diagnostic:', error);
            throw error;
        }
    },

    // ==================== UTILITIES ====================

    // File upload helper (kept for compatibility, but should use StorageService directly)
    convertFileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    },

    // Reset data (for development/testing)
    async reset(): Promise<void> {
        localStorage.clear();
        window.location.reload();
    }
};

// Export both the new async store and keep the old one for gradual migration
export { storeV2 as store };
