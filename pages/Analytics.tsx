import React from 'react';
import { store } from '../services/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, Users, CalendarCheck } from 'lucide-react';
import { JobStatus } from '../types';

export const Analytics: React.FC = () => {
  const jobs = store.getJobs();
  const customers = store.getCustomers();

  // Mock Revenue Data (Last 6 Months)
  const revenueData = [
    { name: 'Jan', revenue: 4000 },
    { name: 'Feb', revenue: 3000 },
    { name: 'Mar', revenue: 2000 },
    { name: 'Apr', revenue: 2780 },
    { name: 'May', revenue: 1890 },
    { name: 'Jun', revenue: 2390 },
  ];

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
             <button className="px-3 py-1 bg-gray-100 font-medium rounded">Last 6 Months</button>
             <button className="px-3 py-1 text-gray-500 hover:bg-gray-50 rounded">Year to Date</button>
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