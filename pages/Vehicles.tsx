import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { Plus, Zap, Fuel, Car, Search, History, Gauge, X, Loader2 } from 'lucide-react';
import { Vehicle, Customer } from '../types';

export const Vehicles: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Mileage History Modal State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [manualMileage, setManualMileage] = useState<number>(0);

    // Vehicle Details Modal State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);

    const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({ fuelType: 'Petrol' });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedVehicles, fetchedCustomers] = await Promise.all([
                store.getVehicles(),
                store.getCustomers()
            ]);
            setVehicles(fetchedVehicles);
            setCustomers(fetchedCustomers);
        } catch (error) {
            console.error("Failed to load vehicle data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newVehicle.registration && newVehicle.ownerId) {
            setIsLoading(true);
            try {
                await store.addVehicle(newVehicle as Vehicle);
                await loadData();
                setIsModalOpen(false);
                setNewVehicle({ fuelType: 'Petrol' });
            } catch (error) {
                console.error("Failed to save vehicle", error);
                alert("Failed to save vehicle");
                setIsLoading(false);
            }
        }
    };

    const handleMileageUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedVehicle && manualMileage > 0) {
            try {
                await store.updateVehicleMileage(selectedVehicle.id, manualMileage, 'Manual Update (Vehicle Manager)');
                // Optimistically update local state or just refresh
                await loadData();

                // Update selected vehicle in modal view
                // Warning: loadData updates 'vehicles', but 'selectedVehicle' is separate state.
                // We need to re-find it from the fresh list or just manual patch.
                // Let's manual patch for smooth UI since we know the result.
                const updatedHist = [{
                    date: new Date().toISOString(),
                    mileage: manualMileage,
                    source: 'Manual Update (Vehicle Manager)'
                }, ...(selectedVehicle.mileageHistory || [])];

                setSelectedVehicle({
                    ...selectedVehicle,
                    mileage: manualMileage,
                    mileageHistory: updatedHist
                });

                setManualMileage(0);
            } catch (error) {
                console.error("Failed to update mileage", error);
                alert("Failed to update mileage");
            }
        }
    };

    const openHistory = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setManualMileage(vehicle.mileage);
        setIsHistoryOpen(true);
    };

    const openDetails = (vehicle: Vehicle) => {
        setDetailsVehicle(vehicle);
        setIsDetailsOpen(true);
    };

    const getFuelIcon = (type: string) => {
        switch (type) {
            case 'Electric': return <Zap size={16} className="text-yellow-500" />;
            case 'Hybrid': return <Zap size={16} className="text-green-500" />;
            default: return <Fuel size={16} className="text-gray-500" />;
        }
    };

    if (isLoading && vehicles.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="text-gray-500">Loading fleet data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Fleet & Vehicles</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <Plus size={18} /> Add Vehicle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.map((v) => {
                    const owner = customers.find(c => c.id === v.ownerId);
                    return (
                        <div
                            key={v.id}
                            onClick={() => openDetails(v)}
                            className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="bg-gray-100 p-2 rounded-lg">
                                        <Car size={24} className="text-slate-700" />
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded border border-slate-200">
                                            {v.registration}
                                        </span>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{v.year} {v.make} {v.model}</h3>
                                <p className="text-sm text-gray-500 mb-4">{v.vin}</p>

                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                        <span>Owner</span>
                                        <span className="font-medium text-gray-900">{owner?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                        <span>Fuel Type</span>
                                        <div className="flex items-center gap-1 font-medium text-gray-900">
                                            {getFuelIcon(v.fuelType)} {v.fuelType}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Mileage</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{v.mileage.toLocaleString()} km</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openHistory(v);
                                                }}
                                                className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                                title="View Mileage History"
                                            >
                                                <History size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {vehicles.length === 0 && !isLoading && (
                <div className="text-center py-12 text-gray-500">
                    No vehicles found in the database.
                </div>
            )}

            {/* ADD VEHICLE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Add Vehicle</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <select className="w-full border p-2 rounded" required value={newVehicle.ownerId || ''} onChange={e => setNewVehicle({ ...newVehicle, ownerId: e.target.value })}>
                                <option value="">Select Owner</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input type="text" placeholder="Registration (License Plate)" required className="w-full border p-2 rounded" value={newVehicle.registration || ''} onChange={e => setNewVehicle({ ...newVehicle, registration: e.target.value })} />
                            <input type="text" placeholder="VIN" required className="w-full border p-2 rounded" value={newVehicle.vin || ''} onChange={e => setNewVehicle({ ...newVehicle, vin: e.target.value })} />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Make" required className="w-full border p-2 rounded" value={newVehicle.make || ''} onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })} />
                                <input type="text" placeholder="Model" required className="w-full border p-2 rounded" value={newVehicle.model || ''} onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="Year" required className="w-full border p-2 rounded" value={newVehicle.year || ''} onChange={e => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) })} />
                                <input type="number" placeholder="Mileage" required className="w-full border p-2 rounded" value={newVehicle.mileage || ''} onChange={e => setNewVehicle({ ...newVehicle, mileage: parseInt(e.target.value) })} />
                            </div>
                            <select className="w-full border p-2 rounded" value={newVehicle.fuelType} onChange={e => setNewVehicle({ ...newVehicle, fuelType: e.target.value as any })}>
                                <option value="Petrol">Petrol</option>
                                <option value="Diesel">Diesel</option>
                                <option value="Electric">Electric</option>
                                <option value="Hybrid">Hybrid</option>
                            </select>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                    {isLoading ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MILEAGE HISTORY MODAL */}
            {isHistoryOpen && selectedVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Gauge className="text-blue-600" /> Mileage History
                                </h3>
                                <p className="text-sm text-gray-500">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.registration})</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 bg-gray-50 border-b border-gray-100">
                            <form onSubmit={handleMileageUpdate} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Update Current Reading</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            min={selectedVehicle.mileage}
                                            className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={manualMileage}
                                            onChange={e => setManualMileage(parseInt(e.target.value))}
                                        />
                                        <span className="absolute right-3 top-2 text-gray-400 text-sm">km</span>
                                    </div>
                                </div>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                                    Update Log
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-4">Historical Records</h4>
                            <div className="relative border-l-2 border-blue-100 ml-3 space-y-6">
                                {selectedVehicle.mileageHistory && selectedVehicle.mileageHistory.length > 0 ? (
                                    selectedVehicle.mileageHistory.map((record, idx) => (
                                        <div key={idx} className="relative pl-8 group">
                                            <div className={`absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`font-bold ${idx === 0 ? 'text-gray-900 text-lg' : 'text-gray-600'}`}>
                                                        {record.mileage.toLocaleString()} km
                                                    </p>
                                                    <p className="text-sm text-gray-500">{record.source}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-medium text-gray-400">{new Date(record.date).toLocaleDateString()}</p>
                                                    <p className="text-xs text-gray-300">{new Date(record.date).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="pl-8 text-gray-400 italic">No history recorded yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VEHICLE DETAILS MODAL */}
            {isDetailsOpen && detailsVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                            <div className="flex items-start gap-4">
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <Car size={32} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {detailsVehicle.year} {detailsVehicle.make} {detailsVehicle.model}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        <span className="inline-block bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded border border-slate-200 mr-2">
                                            {detailsVehicle.registration}
                                        </span>
                                        VIN: {detailsVehicle.vin}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Vehicle Information */}
                                <div className="bg-gray-50 rounded-lg p-5">
                                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        <Car size={18} /> Vehicle Information
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="text-sm text-gray-600">Make</span>
                                            <span className="font-medium text-gray-900">{detailsVehicle.make}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="text-sm text-gray-600">Model</span>
                                            <span className="font-medium text-gray-900">{detailsVehicle.model}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="text-sm text-gray-600">Year</span>
                                            <span className="font-medium text-gray-900">{detailsVehicle.year}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="text-sm text-gray-600">Color</span>
                                            <span className="font-medium text-gray-900">{detailsVehicle.color || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="text-sm text-gray-600">Fuel Type</span>
                                            <div className="flex items-center gap-1 font-medium text-gray-900">
                                                {getFuelIcon(detailsVehicle.fuelType)} {detailsVehicle.fuelType}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Current Mileage</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{detailsVehicle.mileage.toLocaleString()} km</span>
                                                <button
                                                    onClick={() => {
                                                        setIsDetailsOpen(false);
                                                        openHistory(detailsVehicle);
                                                    }}
                                                    className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                                    title="View History"
                                                >
                                                    <History size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Owner Information */}
                                <div className="bg-gray-50 rounded-lg p-5">
                                    <h4 className="font-bold text-gray-700 mb-4">Owner Information</h4>
                                    {(() => {
                                        const owner = customers.find(c => c.id === detailsVehicle.ownerId);
                                        return owner ? (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                                    <span className="text-sm text-gray-600">Name</span>
                                                    <span className="font-medium text-gray-900">{owner.name}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                                    <span className="text-sm text-gray-600">Email</span>
                                                    <span className="font-medium text-gray-900">{owner.email}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                                    <span className="text-sm text-gray-600">Phone</span>
                                                    <span className="font-medium text-gray-900">{owner.phone}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">Type</span>
                                                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                                        {owner.type || 'Individual'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 italic">Owner information not available</p>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Recent Service History */}
                            <div className="mt-6 bg-gray-50 rounded-lg p-5">
                                <h4 className="font-bold text-gray-700 mb-4">Recent Service History</h4>
                                {/* Note: Jobs still need to be migrated to storeV2 for this to work perfectly across all entities, 
                              this viewer currently relies on store.getJobs which is not yet async in this context 
                              Wait - Vehicles.tsx does NOT import jobs? 
                              Ah, the original code used store.getJobs() inside the render.
                              We need to fetch jobs too or just show a placeholder for now until Jobs page is migrated.
                              For now I will comment out the Jobs history part or fetch it if I can.
                              Since Jobs aren't migrated, let's just make sure we don't break.
                              But wait, we are migrating incrementally. 
                              The original code did: const jobs = store.getJobs().filter...
                              In storeV2, getJobs() is async. We can't call it in render.
                              I will remove the service history section temporarily or fetch it in loadData.
                              Let's fetch it in loadData for completeness, although Jobs data might still be local if not migrated.
                              Actually, storeV2.getJobs() will try Firestore then Local.
                           */}
                                <p className="text-gray-400 italic">Service history will be available after Jobs migration.</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setIsDetailsOpen(false)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
