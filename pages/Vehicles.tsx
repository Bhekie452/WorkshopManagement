import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { Pagination, paginate } from '../components/Pagination';
import { useAuth } from '../components/AuthContext';
import { Permission } from '../services/rbac';
import { Plus, Zap, Fuel, Car, Search, History, Gauge, X, Loader2, Trash2, Edit, LayoutList, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { Vehicle, Customer, Job } from '../types';
import { AdvancedFilterPanel } from '../components/ui/AdvancedFilterPanel';
import { BulkActionPanel } from '../components/ui/BulkActionPanel';

export const Vehicles: React.FC = () => {
    const { can } = useAuth();
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
    const [jobs, setJobs] = useState<Job[]>([]);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Vehicle>>({});

    const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({ fuelType: 'Petrol' });
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filterFuel, setFilterFuel] = useState<string>('ALL');
    const [filterMake, setFilterMake] = useState<string>('ALL');
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedVehicles, fetchedCustomers] = await Promise.all([
                store.getVehicles(),
                store.getCustomers()
            ]);
            setVehicles(fetchedVehicles);
            setCustomers(fetchedCustomers);
            try { setJobs(store.getJobs()); } catch { setJobs([]); }
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
        setEditData({ ...vehicle });
        setIsEditing(false);
        setIsDetailsOpen(true);
    };

    const handleDelete = async (v: Vehicle) => {
        if (confirm(`Delete vehicle "${v.year} ${v.make} ${v.model} (${v.registration})"? This cannot be undone.`)) {
            setIsLoading(true);
            try {
                await store.deleteVehicle(v.id);
                setIsDetailsOpen(false);
                await loadData();
            } catch (error) {
                console.error('Failed to delete vehicle', error);
                alert('Failed to delete vehicle.');
                setIsLoading(false);
            }
        }
    };

    const handleBulkDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedVehicleIds.length} vehicles?`)) {
            setIsLoading(true);
            Promise.all(selectedVehicleIds.map(id => store.deleteVehicle(id)))
                .then(() => {
                    setSelectedVehicleIds([]);
                    loadData();
                })
                .catch(err => {
                    console.error('Failed to bulk delete', err);
                    alert('Failed to delete some vehicles.');
                    setIsLoading(false);
                });
        }
    };

    const handleEditSave = async () => {
        if (!detailsVehicle || !editData.registration || !editData.ownerId) return;
        setIsLoading(true);
        try {
            await store.updateVehicle(detailsVehicle.id, editData);
            setIsEditing(false);
            await loadData();
            setDetailsVehicle({ ...detailsVehicle, ...editData } as Vehicle);
        } catch (error) {
            console.error('Failed to update vehicle', error);
            alert('Failed to update vehicle.');
        } finally {
            setIsLoading(false);
        }
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

    const filteredVehicles = vehicles.filter(v => {
        const matchesSearch = !searchQuery || (() => {
            const q = searchQuery.toLowerCase();
            const owner = customers.find(c => c.id === v.ownerId);
            return (
                `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q) ||
                v.registration.toLowerCase().includes(q) ||
                v.vin.toLowerCase().includes(q) ||
                (owner?.name || '').toLowerCase().includes(q) ||
                v.fuelType.toLowerCase().includes(q)
            );
        })();
        const matchesFuel = filterFuel === 'ALL' || v.fuelType === filterFuel;
        const matchesMake = filterMake === 'ALL' || v.make === filterMake;
        return matchesSearch && matchesFuel && matchesMake;
    });

    const makes = [...new Set(vehicles.map(v => v.make))].sort();
    const activeFilterCount = [filterFuel !== 'ALL', filterMake !== 'ALL', searchQuery !== ''].filter(Boolean).length;

    const clearFilters = () => {
        setSearchQuery('');
        setFilterFuel('ALL');
        setFilterMake('ALL');
        setCurrentPage(1);
        setSelectedVehicleIds([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Fleet & Vehicles</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!can(Permission.MANAGE_VEHICLES)}
                    title={!can(Permission.MANAGE_VEHICLES) ? 'You do not have permission' : ''}
                >
                    <Plus size={18} /> Add Vehicle
                </button>
            </div>

            <BulkActionPanel 
                selectedCount={selectedVehicleIds.length}
                onClearSelection={() => setSelectedVehicleIds([])}
                actions={[
                    { label: 'Delete', icon: <Trash2 size={16} />, onClick: handleBulkDelete, variant: 'danger' }
                ]}
            />

            <AdvancedFilterPanel
                searchTerm={searchQuery}
                onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
                onClearFilters={clearFilters}
                placeholder="Search by registration, make, core, or owner..."
                filters={[
                    {
                        id: 'fuel',
                        label: 'Fuel Type',
                        value: filterFuel,
                        onChange: (v) => { setFilterFuel(v); setCurrentPage(1); },
                        options: [
                            { label: 'All Fuel', value: 'ALL' },
                            { label: 'Petrol', value: 'Petrol' },
                            { label: 'Diesel', value: 'Diesel' },
                            { label: 'Electric', value: 'Electric' },
                            { label: 'Hybrid', value: 'Hybrid' },
                        ]
                    },
                    {
                        id: 'make',
                        label: 'Vehicle Make',
                        value: filterMake,
                        onChange: (v) => { setFilterMake(v); setCurrentPage(1); },
                        options: [
                            { label: 'All Makes', value: 'ALL' },
                            ...makes.map(m => ({ label: m, value: m }))
                        ]
                    }
                ]}
                presets={[
                    { label: 'Electric/Hybrid', active: filterFuel === 'Electric' || filterFuel === 'Hybrid', onClick: () => { setFilterFuel('Electric'); setCurrentPage(1); } }
                ]}
            />

            {/* View Toggle */}
            <div className="flex justify-end mb-2">
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 shrink-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm border border-blue-200' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Table View"
                    >
                        <LayoutList size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-blue-700 shadow-sm border border-blue-200' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Grid View"
                    >
                        <LayoutGrid size={18} />
                    </button>
                </div>
            </div>

            {/* TABLE VIEW */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-4 py-3 text-center w-12">
                                  <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedVehicleIds.length === filteredVehicles.length && filteredVehicles.length > 0}
                                    ref={input => { if (input) input.indeterminate = selectedVehicleIds.length > 0 && selectedVehicleIds.length < filteredVehicles.length; }}
                                    onChange={e => {
                                      if (e.target.checked) setSelectedVehicleIds(filteredVehicles.map(v => v.id));
                                      else setSelectedVehicleIds([]);
                                    }}
                                  />
                                </th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Vehicle</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Registration</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider hidden md:table-cell">VIN</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Owner</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider hidden sm:table-cell">Fuel Type</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Mileage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginate<Vehicle>(filteredVehicles, currentPage, pageSize).map((v) => {
                                const owner = customers.find(c => c.id === v.ownerId);
                                return (
                                    <tr
                                        key={v.id}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
                                            openDetails(v);
                                        }}
                                        className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedVehicleIds.includes(v.id) ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedVehicleIds.includes(v.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedVehicleIds([...selectedVehicleIds, v.id]);
                                                    else setSelectedVehicleIds(selectedVehicleIds.filter(id => id !== v.id));
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-gray-100 p-1.5 rounded-lg">
                                                    <Car size={18} className="text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{v.year} {v.make} {v.model}</p>
                                                    <p className="text-xs text-gray-400 md:hidden">{v.vin}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-block bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded border border-slate-200">
                                                {v.registration}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono text-xs">{v.vin}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{owner?.name || 'Unknown'}</td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <div className="flex items-center gap-1 text-gray-700">
                                                {getFuelIcon(v.fuelType)} {v.fuelType}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="font-medium text-gray-900">{v.mileage.toLocaleString()} km</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openHistory(v); }}
                                                    className="text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors"
                                                    title="Mileage History"
                                                >
                                                    <History size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredVehicles.length === 0 && (
                        <div className="text-center py-8 text-gray-400">No vehicles match your search.</div>
                    )}
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredVehicles.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            )}

            {/* GRID VIEW */}
            {viewMode === 'grid' && <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginate<Vehicle>(filteredVehicles, currentPage, pageSize).map((v) => {
                    const owner = customers.find(c => c.id === v.ownerId);
                    return (
                        <div
                            key={v.id}
                            onClick={(e) => {
                                if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
                                openDetails(v);
                            }}
                            className={`bg-white rounded-lg p-5 shadow-sm border ${selectedVehicleIds.includes(v.id) ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-100'} flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all`}
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedVehicleIds.includes(v.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedVehicleIds([...selectedVehicleIds, v.id]);
                                                    else setSelectedVehicleIds(selectedVehicleIds.filter(id => id !== v.id));
                                                }}
                                            />
                                        </div>
                                        <div className="bg-gray-100 p-2 rounded-lg">
                                            <Car size={24} className="text-slate-700" />
                                        </div>
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
            <Pagination
                currentPage={currentPage}
                totalItems={filteredVehicles.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />
            </div>}

            {filteredVehicles.length === 0 && viewMode === 'grid' && (
                <div className="text-center py-12 text-gray-500">
                    {searchQuery ? 'No vehicles match your search.' : 'No vehicles found in the database.'}
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
                            <div className="flex items-center gap-2">
                                {can(Permission.MANAGE_VEHICLES) && <button
                                    onClick={() => { setEditData({ ...detailsVehicle }); setIsEditing(!isEditing); }}
                                    className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                    title="Edit Vehicle"
                                >
                                    <Edit size={18} />
                                </button>}
                                {can(Permission.MANAGE_VEHICLES) && <button
                                    onClick={() => handleDelete(detailsVehicle)}
                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    title="Delete Vehicle"
                                >
                                    <Trash2 size={18} />
                                </button>}
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X size={24} />
                                </button>
                            </div>
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
                                {(() => {
                                    const vehicleJobs = jobs.filter(j => j.vehicleId === detailsVehicle.id)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .slice(0, 10);
                                    return vehicleJobs.length > 0 ? (
                                        <div className="space-y-3">
                                            {vehicleJobs.map(j => (
                                                <div key={j.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{j.serviceType}</p>
                                                        <p className="text-sm text-gray-500">{j.description?.slice(0, 60)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                            j.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                            j.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>{j.status}</span>
                                                        <p className="text-xs text-gray-400 mt-1">{new Date(j.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 italic">No service jobs recorded for this vehicle.</p>
                                    );
                                })()}
                            </div>
                            {/* Edit Vehicle Form */}
                            {isEditing && (
                                <div className="mt-6 bg-blue-50 rounded-lg p-5 border border-blue-200">
                                    <h4 className="font-bold text-blue-700 mb-4 flex items-center gap-2">
                                        <Edit size={18} /> Edit Vehicle Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                                            <input type="text" className="w-full border p-2 rounded" value={editData.make || ''} onChange={e => setEditData({ ...editData, make: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                            <input type="text" className="w-full border p-2 rounded" value={editData.model || ''} onChange={e => setEditData({ ...editData, model: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                            <input type="number" className="w-full border p-2 rounded" value={editData.year || ''} onChange={e => setEditData({ ...editData, year: Number(e.target.value) })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                            <input type="text" className="w-full border p-2 rounded" value={editData.color || ''} onChange={e => setEditData({ ...editData, color: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Registration</label>
                                            <input type="text" className="w-full border p-2 rounded" value={editData.registration || ''} onChange={e => setEditData({ ...editData, registration: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                                            <select className="w-full border p-2 rounded" value={editData.fuelType || 'Petrol'} onChange={e => setEditData({ ...editData, fuelType: e.target.value as "Petrol" | "Diesel" | "Electric" | "Hybrid" })}>
                                                <option value="Petrol">Petrol</option>
                                                <option value="Diesel">Diesel</option>
                                                <option value="Hybrid">Hybrid</option>
                                                <option value="Electric">Electric</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                                            <select className="w-full border p-2 rounded" value={editData.ownerId || ''} onChange={e => setEditData({ ...editData, ownerId: e.target.value })}>
                                                <option value="">Select Owner</option>
                                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                        <button onClick={handleEditSave} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                            {isLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}
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