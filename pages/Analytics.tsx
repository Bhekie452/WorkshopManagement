import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, Users, CalendarCheck, Download, FileSpreadsheet, FileText, Activity } from 'lucide-react';
import { Customer, Invoice, Job, JobStatus } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DateRange = '7d' | '30d' | '90d' | '1y';

const rangeDaysMap: Record<DateRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const currency = (value: number) => `R${Math.round(value).toLocaleString()}`;

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [jobs, setJobs] = useState<Job[]>(() => store.getJobs());
  const [customers, setCustomers] = useState<Customer[]>(() => store.getCustomers());
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const refresh = () => {
      setJobs(store.getJobs());
      setCustomers(store.getCustomers());
      setInvoices(store.getInvoices());
      setLastUpdated(new Date());
    };

    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - rangeDaysMap[dateRange]);

  const inRange = (value?: string) => {
    const date = toDate(value);
    return !!date && date >= startDate && date <= now;
  };

  const filteredJobs = useMemo(() => jobs.filter(job => inRange(job.createdAt)), [jobs, dateRange]);
  const filteredInvoices = useMemo(() => invoices.filter(invoice => inRange(invoice.issueDate)), [invoices, dateRange]);

  const paidInvoices = filteredInvoices.filter(invoice => invoice.type === 'Invoice' && invoice.status === 'Paid');
  const completedJobs = filteredJobs.filter(job => job.status === JobStatus.COMPLETED);

  const totalRevenue = paidInvoices.reduce((acc, invoice) => acc + (invoice.total || 0), 0);
  const avgJobValue = completedJobs.reduce((acc, job) => acc + (job.estimatedCost || 0), 0) / (completedJobs.length || 1);

  const activeCustomerIds = new Set<string>([
    ...filteredJobs.map(job => job.customerId),
    ...filteredInvoices.map(invoice => invoice.customerId),
  ]);
  const activeCustomers = customers.filter(customer => activeCustomerIds.has(customer.id));

  const completionRate = Math.round((completedJobs.length / (filteredJobs.length || 1)) * 100);

  const step = dateRange === '7d' ? 1 : dateRange === '30d' ? 3 : dateRange === '90d' ? 7 : 30;
  const revenueData = useMemo(() => {
    const points: Array<{ name: string; revenue: number }> = [];
    const cursor = new Date(startDate);

    while (cursor <= now) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + step - 1);
      if (bucketEnd > now) bucketEnd.setTime(now.getTime());

      const label = step >= 30
        ? bucketStart.toLocaleString('default', { month: 'short' })
        : bucketStart.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });

      const bucketRevenue = paidInvoices
        .filter(invoice => {
          const issueDate = toDate(invoice.issueDate);
          return !!issueDate && issueDate >= bucketStart && issueDate <= bucketEnd;
        })
        .reduce((sum, invoice) => sum + (invoice.total || 0), 0);

      points.push({ name: label, revenue: bucketRevenue });
      cursor.setDate(cursor.getDate() + step);
    }

    return points;
  }, [paidInvoices, dateRange, lastUpdated]);

  const statusCounts = filteredJobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(statusCounts).map(status => ({
    name: status,
    value: statusCounts[status],
  }));

  const serviceCounts = filteredJobs.reduce((acc, job) => {
    const service = job.serviceType || 'General Service';
    acc[service] = (acc[service] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const serviceData = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const customerRevenue = paidInvoices.reduce((acc, invoice) => {
    acc[invoice.customerId] = (acc[invoice.customerId] || 0) + (invoice.total || 0);
    return acc;
  }, {} as Record<string, number>);

  const topCustomers = Object.entries(customerRevenue)
    .map(([customerId, revenue]) => ({
      customerId,
      name: customers.find(customer => customer.id === customerId)?.name || 'Unknown Customer',
      revenue: Number(revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#06b6d4', '#ef4444'];

  const rangeLabel = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '1y': 'Last 1 Year',
  }[dateRange];

  const handleExportCSV = () => {
    const summaryRows = [
      ['Metric', 'Value'],
      ['Range', rangeLabel],
      ['Total Revenue', totalRevenue.toFixed(2)],
      ['Average Job Value', avgJobValue.toFixed(2)],
      ['Active Customers', String(activeCustomers.length)],
      ['Completed Jobs', String(completedJobs.length)],
      ['Completion Rate (%)', String(completionRate)],
      [],
      ['Top Customers', 'Revenue'],
      ...topCustomers.map(item => [item.name, item.revenue.toFixed(2)]),
      [],
      ['Service Type', 'Jobs'],
      ...serviceData.map(item => [item.name, String(item.count)]),
    ];

    const csv = summaryRows
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Analytics Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${rangeLabel}`, 14, 24);
    doc.text(`Generated: ${new Date().toLocaleString('en-ZA')}`, 14, 30);

    autoTable(doc, {
      startY: 36,
      head: [['KPI', 'Value']],
      body: [
        ['Total Revenue', currency(totalRevenue)],
        ['Average Job Value', currency(avgJobValue)],
        ['Active Customers', String(activeCustomers.length)],
        ['Completed Jobs', String(completedJobs.length)],
        ['Completion Rate', `${completionRate}%`],
      ],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Top Customers', 'Revenue']],
      body: topCustomers.length
        ? topCustomers.map(customer => [customer.name, currency(customer.revenue)])
        : [['No customer data', '-']],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Service Type', 'Jobs']],
      body: serviceData.length
        ? serviceData.map(service => [service.name, String(service.count)])
        : [['No service data', '-']],
    });

    doc.save(`analytics_${dateRange}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Live business intelligence for revenue, workload, and customer performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white border rounded-lg p-1 flex text-sm">
            {(['7d', '30d', '90d', '1y'] as DateRange[]).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded ${dateRange === range ? 'bg-gray-100 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {range}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="bg-white border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FileSpreadsheet size={16} /> Export CSV
          </button>
          <button onClick={handleExportPDF} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <FileText size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Activity size={14} className="text-green-500" />
        Real-time updates enabled • Last refresh {lastUpdated.toLocaleTimeString('en-ZA')}
      </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{currency(totalRevenue)}</h3>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{rangeLabel}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Avg Job Value</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{currency(avgJobValue)}</h3>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Active Customers</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{activeCustomers.length}</h3>
                  </div>
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Users size={20} /></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-sm font-medium text-gray-500">Jobs Completed</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">{completedJobs.length}</h3>
                  </div>
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><CalendarCheck size={20} /></div>
              </div>
              <p className="text-xs text-green-600 mt-2 flex items-center"><TrendingUp size={12} className="mr-1"/> {completionRate}% completion rate</p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Trends</h3>
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
                     <Tooltip formatter={(value: number) => [currency(value), 'Revenue']} />
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
                       label={({name, percent}: { name: string; percent?: number }) => `${name} ${(((percent || 0) * 100)).toFixed(0)}%`}
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

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Service Analysis</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={serviceData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} />
                     <YAxis allowDecimals={false} />
                     <Tooltip formatter={(value: number) => [value, 'Jobs']} />
                     <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Top Customers</h3>
               <div className="space-y-3">
                 {topCustomers.length === 0 && (
                   <p className="text-sm text-gray-500">No paid invoice data in this range.</p>
                 )}
                 {topCustomers.map((customer, index) => (
                   <div key={customer.customerId} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                     <div>
                       <p className="font-medium text-gray-900">#{index + 1} {customer.name}</p>
                       <p className="text-xs text-gray-500">Revenue leader</p>
                     </div>
                     <p className="font-bold text-gray-900">{currency(customer.revenue)}</p>
                   </div>
                 ))}
               </div>
           </div>
       </div>

       <div className="flex justify-end">
         <button onClick={handleExportCSV} className="bg-white border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
           <Download size={16} /> Quick Export CSV
         </button>
       </div>
    </div>
  );
};