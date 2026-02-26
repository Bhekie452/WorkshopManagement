
import React, { useEffect, useMemo, useState } from 'react';
import { FirestoreService } from '../services/firestore';
import { EvBattery, BatteryHealthLog } from '../types';
import { store } from '../services/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BatteryCharging, Zap, Truck, AlertTriangle, CalendarClock, BrainCircuit } from 'lucide-react';
import { Vehicle } from '../types';

type HealthStatus = 'Excellent' | 'Good' | 'Fair' | 'Critical';

interface EvTelemetry {
    vehicle: Vehicle;
    soh: number;
    soc: number;
    estimatedRangeKm: number;
    status: HealthStatus;
    rulMonths: number;
    confidence: number;
    nextMaintenanceDate: string;
    maintenanceReason: string;
    needsAttention: boolean;
    trend: Array<{ period: string; soh: number }>;
    cells: Array<{ cell: string; voltage: number }>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashValue = (input: string) =>
    Array.from(input).reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);

const getHealthStatus = (soh: number): HealthStatus => {
    if (soh >= 90) return 'Excellent';
    if (soh >= 82) return 'Good';
    if (soh >= 74) return 'Fair';
    return 'Critical';
};

const buildTelemetry = (vehicle: Vehicle, tick: number): EvTelemetry => {
    const seed = hashValue(vehicle.vin || vehicle.registration);
    const age = Math.max(1, new Date().getFullYear() - vehicle.year);

    const sohBase = clamp(97 - age * 1.3 - vehicle.mileage / 22000 + (seed % 6), 64, 98);
    const socBase = clamp(80 - (vehicle.mileage % 12000) / 220 + (seed % 18), 10, 96);
    const soc = clamp(Math.round(socBase + Math.sin((tick + seed) / 2.5) * 7), 5, 100);
    const soh = clamp(Math.round(sohBase), 0, 100);

    const trend = Array.from({ length: 6 }, (_, index) => {
        const step = 5 - index;
        const date = new Date();
        date.setMonth(date.getMonth() - step);
        const period = date.toLocaleString('default', { month: 'short' });
        const trendSoh = clamp(soh - step * 0.8 + ((seed + index) % 3), 55, 100);
        return { period, soh: Number(trendSoh.toFixed(1)) };
    });

    const cells = Array.from({ length: 12 }, (_, index) => {
        const ripple = Math.sin((tick + index + seed) / 3) * 0.04;
        const skew = ((seed + index * 11) % 14) / 100;
        const voltage = clamp(3.55 + skew + ripple, 3.2, 4.2);
        return { cell: `C${index + 1}`, voltage: Number(voltage.toFixed(3)) };
    });

    const minCell = Math.min(...cells.map(c => c.voltage));
    const status = getHealthStatus(soh);
    const rulMonths = Math.max(6, Math.round((soh - 58) * 2.1 - vehicle.mileage / 18000));
    const confidence = clamp(Math.round(92 - age * 2 - (100 - soh) / 2), 70, 98);

    const nextMaintenanceDays = Math.max(7, Math.round((100 - soh) * 2 + (soc < 20 ? 12 : 30)));
    const maintenanceDate = new Date();
    maintenanceDate.setDate(maintenanceDate.getDate() + nextMaintenanceDays);
    const nextMaintenanceDate = maintenanceDate.toLocaleDateString('en-ZA');

    const maintenanceReason =
        soh < 78
            ? 'SOH degradation threshold reached'
            : soc < 20
                ? 'Frequent deep discharge risk detected'
                : minCell < 3.35
                    ? 'Cell imbalance observed'
                    : 'Routine predictive inspection';

    return {
        vehicle,
        soh,
        soc,
        estimatedRangeKm: Math.round((soc / 100) * 420 * (soh / 100)),
        status,
        rulMonths,
        confidence,
        nextMaintenanceDate,
        maintenanceReason,
        needsAttention: status === 'Critical' || minCell < 3.3 || soc < 15,
        trend,
        cells,
    };
};

const statusBadgeClasses: Record<HealthStatus, string> = {
    Excellent: 'bg-green-100 text-green-700',
    Good: 'bg-blue-100 text-blue-700',
    Fair: 'bg-yellow-100 text-yellow-700',
    Critical: 'bg-red-100 text-red-700',
};

export const EVFleet: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');

    useEffect(() => {
        const timer = window.setInterval(() => setTick(prev => prev + 1), 15000);
        return () => window.clearInterval(timer);
    }, []);

    const evVehicles = useMemo(
        () => store.getVehicles().filter(v => v.fuelType === 'Electric' || v.fuelType === 'Hybrid'),
        [tick]
    );

        const telemetry = useMemo(() => evVehicles.map(vehicle => buildTelemetry(vehicle, tick)), [evVehicles, tick]);

        // Persist battery records and health logs to Firestore on each telemetry update
        useEffect(() => {
            telemetry.forEach(async (t) => {
                // Upsert battery record
                const battery: EvBattery = {
                    id: t.vehicle.id,
                    vehicleId: t.vehicle.id,
                    soh: t.soh,
                    soc: t.soc,
                    estimatedRangeKm: t.estimatedRangeKm,
                    status: t.status,
                    rulMonths: t.rulMonths,
                    confidence: t.confidence,
                    nextMaintenanceDate: t.nextMaintenanceDate,
                    maintenanceReason: t.maintenanceReason,
                    needsAttention: t.needsAttention,
                    cells: t.cells,
                    createdAt: new Date().toISOString(),
                };
                await FirestoreService.createWithId('ev_batteries', battery.id, battery);

                // Add health log
                const healthLog: BatteryHealthLog = {
                    id: `${t.vehicle.id}_${Date.now()}`,
                    vehicleId: t.vehicle.id,
                    soh: t.soh,
                    soc: t.soc,
                    timestamp: new Date().toISOString(),
                    cells: t.cells,
                };
                await FirestoreService.create('battery_health_logs', healthLog);
            });
        }, [telemetry]);

    useEffect(() => {
        if (telemetry.length && !telemetry.some(t => t.vehicle.id === selectedVehicleId)) {
            setSelectedVehicleId(telemetry[0].vehicle.id);
        }
    }, [telemetry, selectedVehicleId]);

    const selectedTelemetry = telemetry.find(t => t.vehicle.id === selectedVehicleId) ?? telemetry[0];

    const avgSoh = Math.round(telemetry.reduce((acc, current) => acc + current.soh, 0) / (telemetry.length || 1));
    const avgSoc = Math.round(telemetry.reduce((acc, current) => acc + current.soc, 0) / (telemetry.length || 1));
    const totalRange = telemetry.reduce((acc, current) => acc + current.estimatedRangeKm, 0);
    const activeCharging = telemetry.filter(item => item.soc < 35).length;
    const batteryAlerts = telemetry.filter(item => item.needsAttention).length;

    const sohData = telemetry.map(item => ({ name: item.vehicle.registration, soh: item.soh }));
    const fleetTrend = selectedTelemetry
        ? selectedTelemetry.trend.map((point, index) => {
                const avg = telemetry.reduce((acc, item) => acc + item.trend[index].soh, 0) / (telemetry.length || 1);
                return { period: point.period, soh: Number(avg.toFixed(1)) };
            })
        : [];

    const maintenanceRows = telemetry
        .slice()
        .sort((a, b) => new Date(a.nextMaintenanceDate).getTime() - new Date(b.nextMaintenanceDate).getTime());

    if (!telemetry.length) {
        return (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">EV Fleet Management</h1>
                <p className="text-sm text-gray-500 mt-2">No EV or Hybrid vehicles found in your fleet yet.</p>
            </div>
        );
    }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">EV Fleet Management</h1>
                    <p className="text-sm text-gray-500">SOH, SOC, cell health, RUL and predictive maintenance across your EV fleet.</p>
                </div>
                <div className="flex gap-2">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Zap size={14} fill="currentColor" /> {telemetry.length} EVs in Fleet
                    </span>
                </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-500">Fleet Health (SOH)</p>
                        <BatteryCharging className="text-blue-500" size={20} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgSoh}%</p>
                    <p className="text-xs text-gray-500 mt-1">Average battery state of health</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-500">Total Range Avail.</p>
                        <Truck className="text-indigo-500" size={20} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">~{totalRange.toLocaleString()} km</p>
                    <p className="text-xs text-gray-500 mt-1">Calculated from live SOC and SOH</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-500">Charging Now</p>
                        <Zap className="text-yellow-500" size={20} fill="currentColor" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{activeCharging}</p>
                    <p className="text-xs text-gray-500 mt-1">Fleet SOC average: {avgSoc}%</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-500">Battery Alerts</p>
                        <AlertTriangle className="text-red-500" size={20} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{batteryAlerts}</p>
                    <p className={`text-xs mt-1 ${batteryAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {batteryAlerts > 0 ? 'Review flagged vehicles' : 'No critical issues detected'}
                    </p>
        </div>
      </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Fleet Overview</h3>
                    <span className="text-xs text-gray-500">Live updates every 15s</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {telemetry.map(item => (
                        <button
                            key={item.vehicle.id}
                            onClick={() => setSelectedVehicleId(item.vehicle.id)}
                            className={`text-left border rounded-xl p-4 transition-all ${
                                selectedTelemetry?.vehicle.id === item.vehicle.id
                                    ? 'border-blue-400 bg-blue-50/40'
                                    : 'border-gray-100 hover:border-gray-300 bg-white'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-gray-900">{item.vehicle.registration}</p>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[item.status]}`}>
                                    {item.status}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{item.vehicle.year} {item.vehicle.make} {item.vehicle.model}</p>
                            <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">SOH</p>
                                    <p className="font-bold text-gray-900">{item.soh}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">SOC</p>
                                    <p className="font-bold text-gray-900">{item.soc}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">RUL</p>
                                    <p className="font-bold text-gray-900">{item.rulMonths} mo</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Battery State of Health (SOH)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sohData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="soh" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Health %" />
                            </BarChart>
                        </ResponsiveContainer>
          </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Real-time SOC Monitoring</h3>
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {telemetry.map(item => (
                            <div key={item.vehicle.id} className="flex items-center gap-4">
                                <div className="w-24 font-medium text-sm text-gray-700">{item.vehicle.registration}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                    <div
                                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${item.soc > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                                        style={{ width: `${item.soc}%` }}
                                    />
                                </div>
                                <div className="w-12 text-right text-sm font-bold text-gray-900">{item.soc}%</div>
                            </div>
                        ))}
          </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Trend Analysis (SOH Over Time)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fleetTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="period" />
                                <YAxis domain={[60, 100]} />
                                <Tooltip formatter={(value: number) => [`${value}%`, 'Fleet SOH']} />
                                <Line type="monotone" dataKey="soh" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Cell Monitoring (Voltage Distribution)</h3>
                    {selectedTelemetry && (
                        <>
                            <p className="text-sm text-gray-500 mb-4">{selectedTelemetry.vehicle.registration} battery pack</p>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={selectedTelemetry.cells}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="cell" />
                                        <YAxis domain={[3.2, 4.2]} />
                                        <Tooltip formatter={(value: number) => [`${value} V`, 'Voltage']} />
                                        <Bar dataKey="voltage" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BrainCircuit size={18} className="text-violet-500" /> ML Predictions (RUL)
                    </h3>
                    <div className="space-y-3">
                        {telemetry.map(item => (
                            <div key={item.vehicle.id} className="border border-gray-100 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium text-gray-900">{item.vehicle.registration}</p>
                                    <span className="text-sm font-semibold text-gray-700">{item.rulMonths} months RUL</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Model confidence: {item.confidence}%</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CalendarClock size={18} className="text-blue-500" /> Predictive Maintenance Schedule
                    </h3>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                        {maintenanceRows.map(item => (
                            <div key={item.vehicle.id} className="border border-gray-100 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-gray-900">{item.vehicle.registration}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClasses[item.status]}`}>
                                        {item.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 mt-1">Next check: {item.nextMaintenanceDate}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.maintenanceReason}</p>
                            </div>
                        ))}
                    </div>
                </div>
      </div>
    </div>
  );
};
