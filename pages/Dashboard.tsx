import React from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { store } from '../services/store';
import { JobStatus, Priority } from '../types';
import { 
  DollarSign, Wrench, AlertTriangle, CheckCircle2, 
  Car, Clock, TrendingUp, Package, Activity, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const jobs = store.getJobs();
  const invoices = store.getInvoices();
  const parts = store.getParts();
  const vehicles = store.getVehicles();
  const customers = store.getCustomers();

  // --- KPI CALCULATIONS ---
  
  // Financials
  const paidInvoices = invoices.filter(i => i.type === 'Invoice' && i.status === 'Paid');
  const totalRevenue = paidInvoices.reduce((acc, curr) => acc + curr.total, 0);
  
  const outstandingInvoices = invoices.filter(i => i.type === 'Invoice' && (i.status === 'Sent' || i.status === 'Overdue'));
  const outstandingAmount = outstandingInvoices.reduce((acc, curr) => acc + curr.total, 0);

  // Operations
  const activeJobs = jobs.filter(j => 
    [JobStatus.PENDING, JobStatus.IN_PROGRESS, JobStatus.AWAITING_PARTS, JobStatus.AWAITING_APPROVAL].includes(j.status)
  );
  
  const urgentJobs = jobs.filter(j => j.priority === Priority.URGENT && j.status !== JobStatus.COMPLETED).length;
  
  const lowStockCount = parts.filter(p => p.quantity <= p.minLevel).length;

  // --- CHART DATA PREPARATION ---

  // 1. Job Status Distribution (Pie)
  const statusCounts = jobs.reduce((acc, job) => {
    // Group "Active" statuses for cleaner chart
    let key: string = job.status;
    if (key === JobStatus.AWAITING_PARTS || key === JobStatus.AWAITING_APPROVAL) key = 'Waiting';
    
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(statusCounts).map(status => ({
    name: status,
    value: statusCounts[status]
  }));

  const COLORS = {
    'Pending': '#f59e0b', // Amber
    'In Progress': '#3b82f6', // Blue
    'Waiting': '#8b5cf6', // Violet
    'Completed': '#10b981', // Emerald
    'Paid': '#059669', // Green
    'Cancelled': '#ef4444' // Red
  };

  // 2. Revenue Trend (Area - Mocked for demo based on paid invoices)
  // In a real app, you'd group invoices by month. Here we generate synthetic trend.
  const revenueData = [
    { name: 'Mon', total: 4500 },
    { name: 'Tue', total: 7200 },
    { name: 'Wed', total: 3800 },
    { name: 'Thu', total: 9500 },
    { name: 'Fri', total: 12000 },
    { name: 'Sat', total: 6000 },
    { name: 'Sun', total: 2000 },
  ];

  // 3. Service Type Popularity (Bar)
  const serviceCounts = jobs.reduce((acc, job) => {
    const type = job.serviceType || 'General';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.keys(serviceCounts)
    .map(key => ({ name: key, count: serviceCounts[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  // --- COMPONENTS ---

  const StatCard = ({ title, value, subValue, icon: Icon, colorClass, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
          <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full group-hover:bg-gray-100">
           View Details
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subValue && <p className="text-xs mt-2 font-medium">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Workshop Command Center</h1>
           <p className="text-sm text-gray-500">Overview of operations, financials, and fleet status.</p>
        </div>
        <div className="flex items-center gap-3">
           <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2">
             <Clock size={14} /> {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
           </span>
           <button onClick={() => navigate('/jobs')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
             + New Job
           </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue (Paid)" 
          value={`R${totalRevenue.toLocaleString()}`} 
          subValue={<span className="text-green-600 flex items-center gap-1"><TrendingUp size={12} /> +8.5% this month</span>}
          icon={DollarSign} 
          colorClass="bg-green-500 text-green-600"
          onClick={() => navigate('/analytics')}
        />
        <StatCard 
          title="Active Jobs" 
          value={activeJobs.length} 
          subValue={<span className="text-blue-600">{urgentJobs} Urgent Priority</span>}
          icon={Wrench} 
          colorClass="bg-blue-500 text-blue-600"
          onClick={() => navigate('/jobs')}
        />
        <StatCard 
          title="Outstanding Invoices" 
          value={`R${outstandingAmount.toLocaleString()}`} 
          subValue={<span className="text-orange-600">{outstandingInvoices.length} invoices pending</span>}
          icon={Clock} 
          colorClass="bg-orange-500 text-orange-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard 
          title="Inventory Alerts" 
          value={lowStockCount} 
          subValue={<span className="text-red-600">Items below min level</span>}
          icon={Package} 
          colorClass="bg-red-500 text-red-600"
          onClick={() => navigate('/inventory')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity size={20} className="text-gray-400" /> Weekly Performance
            </h3>
            <select className="text-xs border rounded p-1 bg-gray-50 outline-none">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `R${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`R${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Job Status Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Job Status</h3>
          <p className="text-xs text-gray-500 mb-6">Current workflow distribution</p>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-2xl font-bold text-gray-900">{jobs.length}</span>
               <span className="text-xs text-gray-500">Total</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
             {pieData.slice(0,4).map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (COLORS as any)[entry.name] || '#94a3b8' }}></div>
                    <span>{entry.name} ({entry.value})</span>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Vehicles in Workshop (Detailed Table) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <Car className="text-blue-600" size={20} />
                 Vehicles in Workshop
              </h3>
              <p className="text-xs text-gray-500 mt-1">Currently active job cards</p>
            </div>
            <button onClick={() => navigate('/jobs')} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-white text-xs uppercase text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                     <th className="px-6 py-4">Vehicle</th>
                     <th className="px-6 py-4">Job Info</th>
                     <th className="px-6 py-4">Progress</th>
                     <th className="px-6 py-4">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {activeJobs.slice(0, 5).map(job => {
                     const vehicle = vehicles.find(v => v.id === job.vehicleId);
                     const customer = customers.find(c => c.id === job.customerId);
                     const progress = job.tasks?.length ? Math.round((job.tasks.filter(t => t.completed).length / job.tasks.length) * 100) : 0;
                     
                     return (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/jobs')}>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-100 p-2 rounded text-slate-600">
                                    <Car size={18} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">{vehicle?.year} {vehicle?.model}</div>
                                    <div className="text-xs text-gray-500">{vehicle?.registration}</div>
                                </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{job.serviceType}</div>
                              <div className="text-xs text-gray-500">{customer?.name}</div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                                   <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                                <span className="text-xs font-bold text-gray-600">{progress}%</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-full border bg-opacity-10 
                                ${job.status === JobStatus.IN_PROGRESS ? 'bg-blue-500 text-blue-700 border-blue-200' : 
                                  job.status === JobStatus.AWAITING_PARTS ? 'bg-orange-500 text-orange-700 border-orange-200' :
                                  'bg-gray-500 text-gray-700 border-gray-200'}`}>
                                 {job.status}
                              </span>
                           </td>
                        </tr>
                     )
                  })}
                  {activeJobs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-gray-400 text-sm">
                            No vehicles currently active.
                        </td>
                      </tr>
                  )}
               </tbody>
            </table>
          </div>
        </div>

        {/* Recent Service Types (Bar Chart) & Alerts */}
        <div className="space-y-6">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Top Services</h3>
              <div className="h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11}} />
                       <Tooltip cursor={{fill: 'transparent'}} />
                       <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Low Stock Mini-List */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
                   <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
                       <AlertTriangle size={16} /> Low Stock Alerts
                   </h3>
                   <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full font-bold">{lowStockCount}</span>
               </div>
               <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                   {parts.filter(p => p.quantity <= p.minLevel).slice(0, 4).map(p => (
                       <div key={p.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                           <div>
                               <p className="text-sm font-medium text-gray-900">{p.name}</p>
                               <p className="text-xs text-gray-500">SKU: {p.sku}</p>
                           </div>
                           <div className="text-right">
                               <p className="text-sm font-bold text-red-600">{p.quantity} left</p>
                               <p className="text-xs text-gray-400">Min: {p.minLevel}</p>
                           </div>
                       </div>
                   ))}
                   {lowStockCount === 0 && (
                       <div className="p-4 text-center text-xs text-green-600 font-medium">
                           All stock levels are healthy.
                       </div>
                   )}
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};
