
import React from 'react';
import { store } from '../services/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BatteryCharging, Zap, Truck, AlertTriangle } from 'lucide-react';

export const EVFleet: React.FC = () => {
  const vehicles = store.getVehicles().filter(v => v.fuelType === 'Electric' || v.fuelType === 'Hybrid');
  
  // Mock Metric Generation for Charting
  const sohData = vehicles.map(v => ({
    name: v.registration,
    soh: Math.floor(Math.random() * (100 - 85) + 85), // Random SOH between 85-100
    soc: Math.floor(Math.random() * 100) // Random SOC
  }));

  const avgSoh = Math.round(sohData.reduce((acc, curr) => acc + curr.soh, 0) / (sohData.length || 1));
  const activeCharging = Math.floor(Math.random() * vehicles.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
             <h1 className="text-2xl font-bold text-gray-900">EV Fleet Management</h1>
             <p className="text-sm text-gray-500">Monitor battery health (SOH), state of charge (SOC), and maintenance.</p>
         </div>
         <div className="flex gap-2">
             <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                 <Zap size={14} fill="currentColor" /> {vehicles.length} Active EVs
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
             <p className="text-xs text-green-600 mt-1">Excellent Condition</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                 <p className="text-sm font-medium text-gray-500">Total Range Avail.</p>
                 <Truck className="text-indigo-500" size={20} />
             </div>
             <p className="text-2xl font-bold text-gray-900">~2,450 km</p>
             <p className="text-xs text-gray-500 mt-1">Across all vehicles</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                 <p className="text-sm font-medium text-gray-500">Charging Now</p>
                 <Zap className="text-yellow-500" size={20} fill="currentColor" />
             </div>
             <p className="text-2xl font-bold text-gray-900">{activeCharging}</p>
             <p className="text-xs text-gray-500 mt-1">Vehicles connected</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                 <p className="text-sm font-medium text-gray-500">Battery Alerts</p>
                 <AlertTriangle className="text-red-500" size={20} />
             </div>
             <p className="text-2xl font-bold text-gray-900">0</p>
             <p className="text-xs text-green-600 mt-1">No critical issues</p>
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
                 {sohData.map((v, i) => (
                     <div key={i} className="flex items-center gap-4">
                         <div className="w-24 font-medium text-sm text-gray-700">{v.name}</div>
                         <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                             <div 
                                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${v.soc > 20 ? 'bg-green-500' : 'bg-red-500'}`} 
                                style={{ width: `${v.soc}%` }}
                             />
                         </div>
                         <div className="w-12 text-right text-sm font-bold text-gray-900">{v.soc}%</div>
                     </div>
                 ))}
              </div>
          </div>
      </div>
    </div>
  );
};
