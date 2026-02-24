/**
 * Data Seeder for Firestore
 * 
 * Run this once to populate Firestore with initial mock data
 * Usage: Call seedFirestore() when the app first loads
 */

import { FirestoreService, Collections } from './firestore';
import { UserRole, JobStatus, Priority } from '../types';

export const MOCK_DATA = {
    customers: [
        { name: 'Alice Johnson', email: 'alice@example.com', phone: '082 555 0101', address: '123 Maple St', consent: true, type: 'Private' as const, attachments: [] },
        { name: 'Bob Smith', email: 'bob@example.com', phone: '083 555 0102', address: '456 Oak Ave', consent: true, type: 'Private' as const, attachments: [] },
        { name: 'Charlie Davis', email: 'charlie@example.com', phone: '072 555 0103', address: '789 Pine Rd', consent: true, type: 'Private' as const, attachments: [] },
        { name: 'Dept of Transport', email: 'fleet@gov.za', phone: '012 555 9999', address: 'Pretoria Central', consent: true, type: 'Government' as const, department: 'Logistics', attachments: [] },
        { name: 'Swift Logistics', email: 'ops@swift.co.za', phone: '011 555 8888', address: 'Kempton Park', consent: true, type: 'Fleet' as const, attachments: [] },
    ],

    vehicles: [
        { ownerId: '', registration: 'AB 123 CD', vin: '1HGCM82633A004352', make: 'Honda', model: 'Civic', year: 2018, color: 'Silver', fuelType: 'Petrol' as const, mileage: 45000, mileageHistory: [] },
        { ownerId: '', registration: 'XY 987 ZW', vin: '5YJ3E1EA1JF000001', make: 'Tesla', model: 'Model 3', year: 2021, color: 'White', fuelType: 'Electric' as const, mileage: 12000, mileageHistory: [] },
        { ownerId: '', registration: 'EF 456 GH', vin: 'WA1LAAGE6MD000002', make: 'Audi', model: 'e-tron', year: 2022, color: 'Blue', fuelType: 'Electric' as const, mileage: 8000, mileageHistory: [] },
        { ownerId: '', registration: 'GV 001 GP', vin: '123GOV001', make: 'Toyota', model: 'Hilux', year: 2023, color: 'White', fuelType: 'Diesel' as const, mileage: 15000, mileageHistory: [] },
        { ownerId: '', registration: 'SW 999 GP', vin: '999FLT888', make: 'Isuzu', model: 'D-Max', year: 2022, color: 'Red', fuelType: 'Diesel' as const, mileage: 55000, mileageHistory: [] },
    ],

    parts: [
        { name: 'Oil Filter', sku: 'OF-2023', category: 'Filters', quantity: 15, minLevel: 5, costPrice: 50, sellingPrice: 120, location: 'A1-2', supplier: 'AutoParts Co' },
        { name: 'Brake Pad Set', sku: 'BP-554', category: 'Brakes', quantity: 3, minLevel: 4, costPrice: 250, sellingPrice: 650, location: 'B2-1', supplier: 'BrakeMasters' },
        { name: 'Synthetic Oil 5W-30', sku: 'OIL-5W30', category: 'Fluids', quantity: 20, minLevel: 10, costPrice: 150, sellingPrice: 350, location: 'C1-1', supplier: 'LubeTech' },
        { name: 'Spark Plug', sku: 'SP-NGK', category: 'Ignition', quantity: 40, minLevel: 12, costPrice: 30, sellingPrice: 80, location: 'A2-3', supplier: 'Sparky Inc' },
        { name: 'Cabin Air Filter', sku: 'CF-99', category: 'Filters', quantity: 2, minLevel: 5, costPrice: 80, sellingPrice: 220, location: 'A1-3', supplier: 'AutoParts Co' },
    ]
};

export async function seedFirestore(): Promise<void> {
    try {
        console.log('🌱 Starting Firestore data seeding...');

        // Check if data already exists
        const existingCustomers = await FirestoreService.getAll(Collections.CUSTOMERS);
        if (existingCustomers.length > 0) {
            console.log('✅ Data already seeded. Skipping...');
            return;
        }

        // Seed Customers
        console.log('📋 Seeding customers...');
        const customerIds: string[] = [];
        for (const customer of MOCK_DATA.customers) {
            const id = await FirestoreService.create(Collections.CUSTOMERS, customer);
            customerIds.push(id);
            console.log(`  ✓ Created customer: ${customer.name}`);
        }

        // Seed Vehicles (link to customers)
        console.log('🚗 Seeding vehicles...');
        const vehicleIds: string[] = [];
        for (let i = 0; i < MOCK_DATA.vehicles.length; i++) {
            const vehicle = {
                ...MOCK_DATA.vehicles[i],
                ownerId: customerIds[i] || customerIds[0], // Link to customer
                mileageHistory: [{
                    date: new Date().toISOString(),
                    mileage: MOCK_DATA.vehicles[i].mileage,
                    source: 'Initial Import'
                }]
            };
            const id = await FirestoreService.create(Collections.VEHICLES, vehicle);
            vehicleIds.push(id);
            console.log(`  ✓ Created vehicle: ${vehicle.make} ${vehicle.model}`);
        }

        // Seed Parts
        console.log('🔧 Seeding parts...');
        for (const part of MOCK_DATA.parts) {
            await FirestoreService.create(Collections.PARTS, part);
            console.log(`  ✓ Created part: ${part.name}`);
        }

        // Seed sample jobs
        console.log('📝 Seeding jobs...');
        if (customerIds.length > 0 && vehicleIds.length > 0) {
            const sampleJob = {
                customerId: customerIds[0],
                vehicleId: vehicleIds[0],
                status: JobStatus.IN_PROGRESS,
                priority: Priority.MEDIUM,
                serviceType: 'Regular Service',
                description: 'Oil change and brake check',
                notes: 'Customer mentioned squeaky brakes',
                estimatedCost: 2500,
                createdAt: new Date().toISOString(),
                dueDate: new Date(Date.now() + 86400000).toISOString(),
                tasks: [
                    { id: 't1', description: 'Drain Oil', completed: true, notes: '' },
                    { id: 't2', description: 'Replace Filter', completed: false, notes: '' }
                ],
                partsUsed: [],
                laborLog: [],
                activityLog: [{
                    id: 'l1',
                    date: new Date().toISOString(),
                    user: 'System',
                    action: 'Created',
                    details: 'Job card created during seeding'
                }],
                notifications: [],
                warranties: [],
                attachments: []
            };

            await FirestoreService.create(Collections.JOBS, sampleJob);
            console.log('  ✓ Created sample job');
        }

        console.log('✅ Firestore seeding complete!');
    } catch (error) {
        console.error('❌ Error seeding Firestore:', error);
        throw error;
    }
}
