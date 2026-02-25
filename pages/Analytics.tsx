import React, { useState } from 'react';
import { store } from '../services/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, Users, CalendarCheck } from 'lucide-react';
import { JobStatus } from '../types';

type DateRange = '6m' | 'ytd' | '12m';

export const Analytics: React.FC = () => {
  const jobs = store.getJobs();
  const customers = store.getCustomers();
  const invoices = store.getInvoices();
  const [dateRange, setDateRange] = useState<DateRange>('6m');

  // --- Build real revenue data from completed jobs & paid invoices ---
  const now = new Date();
  const rangeMonths = dateRange === '6m' ? 6 : dateRange === 'ytd' ? now.getMonth() + 1 : 12;

  const revenueData = Array.from({ length: rangeMonths }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (rangeMonths - 1 - i), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const label = month.toLocaleString('default', { month: 'short' });

    // Sum from completed jobs in this month
    const jobRev = jobs
      .filter(j => j.status === JobStatus.COMPLETED && new Date(j.createdAt) >= month && new Date(j.createdAt) <= monthEnd)
      .reduce((sum, j) => sum + (j.estimatedCost || 0), 0);

    // Sum from paid invoices in this month
    const invRev = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.date) >= month && new Date(inv.date) <= monthEnd)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    return { name: label, revenue: Math.max(jobRev, invRev) };
  });

  // Job Status Distribution for Pie Chart
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(statusCounts).map(status => ({
    name: status,
    value: statusCounts[status]
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const totalRevenue = jobs.reduce((acc, j) => acc + (j.status === JobStatus.COMPLETED ? j.estimatedCost : 0), 0);
  const avgJobValue = totalRevenue / (jobs.filter(j => j.status === JobStatus.COMPLETED).length || 1);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
         <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
         <div className="bg-white border rounded-lg p-1 flex text-sm">
             <button onClick={() => setDateRange('6m')} className={`px-3 py-1 rounded ${dateRange === '6m' ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>Last 6 Months</button>
             <button onClick={() => setDateRange('ytd')} className={`px-3 py-1 rounded ${dateRange === 'ytd' ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>Year to Date</button>
             <button onClick={() => setDateRange('12m')} className={`px-3 py-1 rounded ${dateRange === '12m' ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>Last 12 Months</button>
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">R{totalRevenue.toLocaleString()}</h3>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
              <p className="text-xs text-green-600 mt-2 flex items-center"><TrendingUp size={12} className="mr-1"/> +12.5% vs last period</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Avg Job Value</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">R{avgJobValue.toFixed(0)}</h3>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Active Customers</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</h3>
                  </div>
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Users size={20} /></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Jobs Completed</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{jobs.filter(j => j.status === JobStatus.COMPLETED).length}</h3>
                  </div>
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><CalendarCheck size={20} /></div>
              </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Trend</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                         <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="name" />
                     <YAxis />
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <Tooltip />
                     <Area type="monotone" dataKey="revenue" stroke="#8884d8" fillOpacity={1} fill="url(#colorRevenue)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Job Status Distribution</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={pieData}
                       cx="50%"
                       cy="50%"
                       labelLine={false}
                       outerRadius={80}
                       fill="#8884d8"
                       dataKey="value"
                       label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                     >
                       {pieData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
           </div>
       </div>
    </div>
  );
};