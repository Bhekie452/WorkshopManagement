/**
 * Store Service Tests
 * 
 * Tests the localStorage-based store with mock data operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Priority, JobStatus } from '../types';

// Mock the FirestoreService to avoid actual Firebase calls
vi.mock('../services/firestore', () => ({
  FirestoreService: {
    getAll: vi.fn().mockResolvedValue([]),
    createWithId: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  Collections: {
    CUSTOMERS: 'customers',
    VEHICLES: 'vehicles',
    JOBS: 'jobs',
    PARTS: 'parts',
    APPOINTMENTS: 'appointments',
    INVOICES: 'invoices',
    DIAGNOSTICS: 'diagnostics',
  },
}));

// Import store after mocking
import { store } from '../services/store';

describe('Store Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Customers', () => {
    it('getCustomers returns array of customers', () => {
      const customers = store.getCustomers();
      expect(Array.isArray(customers)).toBe(true);
    });

    it('addCustomer creates new customer', () => {
      const initialCount = store.getCustomers().length;
      
      const newCustomer = {
        id: '',
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '012 345 6789',
        address: '123 Test St',
        consent: true,
        type: 'Private' as const,
        attachments: [],
      };

      const created = store.addCustomer(newCustomer);
      
      expect(created.id).toBeTruthy();
      expect(created.name).toBe('Test Customer');
      expect(store.getCustomers().length).toBe(initialCount + 1);
    });

    it('updateCustomer modifies existing customer', () => {
      const customers = store.getCustomers();
      const original = customers[0];
      
      store.updateCustomer({ ...original, name: 'Updated Name' });
      
      const updated = store.getCustomers().find(c => c.id === original.id);
      expect(updated?.name).toBe('Updated Name');
    });

    it('deleteCustomer removes customer', () => {
      const customers = store.getCustomers();
      const toDelete = customers[0];
      const initialCount = customers.length;
      
      store.deleteCustomer(toDelete.id);
      
      expect(store.getCustomers().length).toBe(initialCount - 1);
      expect(store.getCustomers().find(c => c.id === toDelete.id)).toBeUndefined();
    });
  });

  describe('Vehicles', () => {
    it('getVehicles returns array of vehicles', () => {
      const vehicles = store.getVehicles();
      expect(Array.isArray(vehicles)).toBe(true);
    });

    it('addVehicle creates new vehicle', () => {
      const initialCount = store.getVehicles().length;
      
      const newVehicle = {
        id: '',
        ownerId: 'c1',
        registration: 'NEW 123 GP',
        vin: 'TESTVIN123',
        make: 'Toyota',
        model: 'Corolla',
        year: 2024,
        color: 'Blue',
        fuelType: 'Petrol' as const,
        mileage: 0,
        mileageHistory: [],
      };

      const created = store.addVehicle(newVehicle);
      
      expect(created.id).toBeTruthy();
      expect(created.registration).toBe('NEW 123 GP');
      expect(store.getVehicles().length).toBe(initialCount + 1);
    });

    it('getVehiclesByOwner returns filtered vehicles', () => {
      const vehicles = store.getVehicles();
      if (vehicles.length > 0) {
        const ownerId = vehicles[0].ownerId;
        const ownerVehicles = store.getVehiclesByOwner(ownerId);
        expect(ownerVehicles.every(v => v.ownerId === ownerId)).toBe(true);
      }
    });

    it('updateVehicleMileage updates mileage and history', () => {
      const vehicles = store.getVehicles();
      if (vehicles.length > 0) {
        const vehicle = vehicles[0];
        const newMileage = vehicle.mileage + 1000;
        
        store.updateVehicleMileage(vehicle.id, newMileage, 'Test update');
        
        const updated = store.getVehicles().find(v => v.id === vehicle.id);
        expect(updated?.mileage).toBe(newMileage);
        expect(updated?.mileageHistory.some(h => h.mileage === newMileage)).toBe(true);
      }
    });
  });

  describe('Jobs', () => {
    it('getJobs returns array of jobs', () => {
      const jobs = store.getJobs();
      expect(Array.isArray(jobs)).toBe(true);
    });

    it('addJob creates new job', () => {
      const initialCount = store.getJobs().length;
      
      const newJob = {
        id: '',
        customerId: 'c1',
        vehicleId: 'v1',
        status: JobStatus.PENDING,
        priority: Priority.MEDIUM,
        serviceType: 'Test Service',
        description: 'Test description',
        notes: '',
        estimatedCost: 1000,
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        tasks: [],
        partsUsed: [],
        laborLog: [],
        activityLog: [],
        notifications: [],
        warranties: [],
        attachments: [],
      };

      store.addJob(newJob);
      
      expect(store.getJobs().length).toBe(initialCount + 1);
    });

    it('updateJob modifies existing job', () => {
      const jobs = store.getJobs();
      const original = jobs[0];
      
      store.updateJob({ ...original, status: JobStatus.IN_PROGRESS });
      
      const updated = store.getJobs().find(j => j.id === original.id);
      expect(updated?.status).toBe(JobStatus.IN_PROGRESS);
    });

    it('addJobLog adds activity entry', () => {
      const jobs = store.getJobs();
      if (jobs.length > 0) {
        const job = jobs[0];
        const initialLogCount = job.activityLog?.length || 0;
        
        store.addJobLog(job.id, 'TestAction', 'Test details');
        
        const updated = store.getJobs().find(j => j.id === job.id);
        expect(updated?.activityLog?.length).toBe(initialLogCount + 1);
      }
    });
  });

  describe('Parts / Inventory', () => {
    it('getParts returns array of parts', () => {
      const parts = store.getParts();
      expect(Array.isArray(parts)).toBe(true);
    });

    it('addPart creates new part', () => {
      const initialCount = store.getParts().length;
      
      const newPart = {
        id: '',
        name: 'Test Part',
        sku: 'TP-001',
        category: 'Test',
        quantity: 10,
        minLevel: 5,
        costPrice: 50,
        sellingPrice: 100,
        location: 'A1',
        supplier: 'Test Supplier',
      };

      store.addPart(newPart);
      
      expect(store.getParts().length).toBe(initialCount + 1);
    });

    it('getLowStock returns parts below minimum level', () => {
      const lowStock = store.getLowStock();
      expect(Array.isArray(lowStock)).toBe(true);
      // All items in lowStock should have quantity <= minLevel
      lowStock.forEach(part => {
        expect(part.quantity).toBeLessThanOrEqual(part.minLevel);
      });
    });
  });

  describe('Appointments', () => {
    it('getAppointments returns array', () => {
      const appointments = store.getAppointments();
      expect(Array.isArray(appointments)).toBe(true);
    });

    it('addAppointment creates new appointment', () => {
      const initialCount = store.getAppointments().length;
      
      const newAppt = {
        id: '',
        title: 'Test Appointment',
        customerId: 'c1',
        vehicleId: 'v1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        type: 'Service' as const,
        status: 'Scheduled' as const,
        recurrence: 'None' as const,
      };

      store.addAppointment(newAppt);
      
      expect(store.getAppointments().length).toBe(initialCount + 1);
    });
  });

  describe('Invoices', () => {
    it('getInvoices returns array', () => {
      const invoices = store.getInvoices();
      expect(Array.isArray(invoices)).toBe(true);
    });

    it('addInvoice creates new invoice', () => {
      const initialCount = store.getInvoices().length;
      
      const newInvoice = {
        id: '',
        type: 'Invoice' as const,
        customerId: 'c1',
        vehicleId: 'v1',
        number: 'INV-TEST',
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        items: [],
        subtotal: 1000,
        taxAmount: 150,
        total: 1150,
        status: 'Draft' as const,
      };

      store.addInvoice(newInvoice);
      
      expect(store.getInvoices().length).toBe(initialCount + 1);
    });
  });

  describe('Dashboard Stats', () => {
    it('getDashboardStats returns stats object', () => {
      const stats = store.getDashboardStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalJobs).toBe('number');
      expect(typeof stats.pendingJobs).toBe('number');
      expect(typeof stats.completedJobs).toBe('number');
      expect(typeof stats.totalCustomers).toBe('number');
    });
  });
});
