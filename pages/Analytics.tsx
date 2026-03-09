import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, Users, CalendarCheck, Download, FileSpreadsheet, FileText, Activity, CheckCircle2, AlertTriangle, Smartphone, Mail, ChevronRight, Package, ShieldAlert, Receipt } from 'lucide-react';
import { Customer, Invoice, Job, JobStatus, TechnicianPerformance, TimeTrackingAnalytics } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DateRange = '7d' | '30d' | '90d' | '1y';
type AnalyticsTab = 'overview' | 'technicians' | 'accuracy' | 'parts' | 'customers' | 'financial';

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
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [jobs, setJobs] = useState<Job[]>(() => store.getJobs());
  const [customers, setCustomers] = useState<Customer[]>(() => store.getCustomers());
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [techPerformance, setTechPerformance] = useState<TechnicianPerformance[]>([]);
  const [timeAnalytics, setTimeAnalytics] = useState<TimeTrackingAnalytics | null>(null);
  const [partsAnalytics, setPartsAnalytics] = useState<any>(null);
  const [clvAnalytics, setClvAnalytics] = useState<any>(null);
  const [financialReports, setFinancialReports] = useState<{pl: any; tax: any; monthly: any; costByService: any}>({pl: null, tax: null, monthly: null, costByService: null});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      setIsLoading(true);
      try {
        setJobs(store.getJobs());
        setCustomers(store.getCustomers());
        setInvoices(store.getInvoices());
        const techData = await store.getTechnicianPerformance();
        setTechPerformance(techData);
        const timeData = await store.getTimeAccuracyAnalytics();
        setTimeAnalytics(timeData);
        try {
          const token = localStorage.getItem('auth_token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const [partsRes, clvRes] = await Promise.all([
            fetch('/api/analytics/parts-usage', { headers }),
            fetch('/api/analytics/customer-value', { headers }),
          ]);
          if (partsRes.ok) setPartsAnalytics(await partsRes.json());
          if (clvRes.ok) setClvAnalytics(await clvRes.json());
          const [plRes, taxRes, monthlyRes, costRes] = await Promise.all([
            fetch('/api/analytics/financial/pl-statement', { headers }),
            fetch('/api/analytics/financial/tax-summary', { headers }),
            fetch('/api/analytics/financial/monthly-revenue', { headers }),
            fetch('/api/analytics/financial/cost-by-service', { headers }),
          ]);
          setFinancialReports({
            pl: plRes.ok ? await plRes.json() : null,
            tax: taxRes.ok ? await taxRes.json() : null,
            monthly: monthlyRes.ok ? await monthlyRes.json() : null,
            costByService: costRes.ok ? await costRes.json() : null,
          });
        } catch (e) {
          console.warn('Advanced analytics endpoints unavailable', e);
        }
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 30000);
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
        {isLoading ? 'Fetching data signature...' : `Real-time updates enabled • Last refresh ${lastUpdated.toLocaleTimeString('en-ZA')}`}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Business Overview
          </button>
          <button
            onClick={() => setActiveTab('technicians')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'technicians'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Technician Productivity
          </button>
          <button
            onClick={() => setActiveTab('accuracy')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'accuracy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Estimation Accuracy
          </button>
          <button
            onClick={() => setActiveTab('parts')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'parts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Parts Analytics
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'customers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Customer Value
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'financial'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Financial Reports
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-500">
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
                           label={(props: any) => `${props.name} ${((props.percent * 100)).toFixed(0)}%`}
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
        </div>
      )}

      {activeTab === 'technicians' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Avg Utilization</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {Math.round(techPerformance.reduce((acc, t) => acc + t.utilizationRate, 0) / (techPerformance.length || 1))}%
                </h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Top Performer</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {[...techPerformance].sort((a, b) => b.jobsCompleted - a.jobsCompleted)[0]?.technicianName || 'N/A'}
                </h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-sm font-medium text-gray-500">Quality Index</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {Math.round(techPerformance.reduce((acc, t) => acc + t.qualityScore, 0) / (techPerformance.length || 1))}%
                </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 font-premium">Technician Efficiency Ranking</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techPerformance} layout="vertical" margin={{ left: 40, right: 40, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="technicianName" type="category" width={100} tick={{ fontSize: 12, fontWeight: 500 }} />
                  <Tooltip />
                  <Bar dataKey="jobsCompleted" name="Jobs Completed" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  <Bar dataKey="utilizationRate" name="Utilization %" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-gray-900 uppercase tracking-tighter">Technician</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900 uppercase tracking-tighter">Jobs</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900 uppercase tracking-tighter">Avg Time</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900 uppercase tracking-tighter">Revenue</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900 uppercase tracking-tighter">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {techPerformance.map(tech => (
                  <tr key={tech.technicianId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{tech.technicianName}</td>
                    <td className="px-6 py-4 text-gray-600">{tech.jobsCompleted}</td>
                    <td className="px-6 py-4 text-gray-600">{tech.avgTimePerJob.toFixed(1)}h</td>
                    <td className="px-6 py-4 font-bold text-blue-600">{currency(tech.revenueGenerated)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${tech.qualityScore}%` }} />
                        </div>
                        <span className="text-[10px] font-black">{tech.qualityScore}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'accuracy' && timeAnalytics && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm col-span-1">
              <h3 className="text-sm font-medium text-gray-500 mb-4 text-center">Estimation Accuracy</h3>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle 
                        cx="64" cy="64" r="56" fill="none" stroke="#3b82f6" strokeWidth="8" 
                        strokeDasharray={351.8}
                        strokeDashoffset={351.8 * (1 - (timeAnalytics.overallAccuracy || 0) / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                   </svg>
                   <div className="absolute text-center">
                      <span className="text-3xl font-bold text-gray-900">{Math.round(timeAnalytics.overallAccuracy || 0)}%</span>
                   </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-4 text-center">Target: &gt;85% jobs within ±20% variance.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-6 font-premium">Accuracy by Service Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeAnalytics.metricsByService} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="serviceType" stroke="#94a3b8" fontSize={12} />
                    <YAxis unit="%" stroke="#94a3b8" fontSize={12} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                      formatter={(value: number) => [`${value}%`, 'Accuracy']} 
                    />
                    <Bar dataKey="accuracyPercentage" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                      {timeAnalytics.metricsByService.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.accuracyPercentage > 80 ? '#10b981' : entry.accuracyPercentage > 60 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity size={20} className="text-blue-500" /> Service Performance
              </h3>
              <div className="space-y-4">
                {timeAnalytics.metricsByService.map((metric) => (
                  <div key={metric.serviceType} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{metric.serviceType}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        metric.avgVariance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {metric.avgVariance > 0 ? `+${metric.avgVariance.toFixed(1)}h over` : `${Math.abs(metric.avgVariance).toFixed(1)}h under`}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 lowercase">
                      <span>Est: {metric.avgEstimatedHours.toFixed(1)}h vs Act: {metric.avgActualHours.toFixed(1)}h</span>
                      <span>{metric.jobCount} jobs</span>
                    </div>
                    <div className="w-full bg-gray-50 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${metric.accuracyPercentage > 80 ? 'bg-emerald-500' : metric.accuracyPercentage > 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${metric.accuracyPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-500" /> Key Insights
              </h3>
              <div className="space-y-4">
                {timeAnalytics.topBottlenecks && timeAnalytics.topBottlenecks.length > 0 ? (
                  timeAnalytics.topBottlenecks.map((bottleneck, idx) => (
                    <div key={idx} className="flex gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-xs tracking-wider uppercase">{bottleneck.serviceType} Bottleneck</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Consistently takes <span className="font-bold text-rose-600">{bottleneck.avgVariance.toFixed(1)}h longer</span> than estimated.
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                     <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                     <p className="text-gray-500 font-medium text-sm">No major time variances detected.</p>
                  </div>
                )}

                {timeAnalytics.topBottlenecks && timeAnalytics.topBottlenecks.length > 0 && (
                  <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      <strong>Pro tip:</strong> Increasing the estimated duration for <strong>{timeAnalytics.topBottlenecks[0]?.serviceType}</strong> by {Math.round((timeAnalytics.topBottlenecks[0]?.avgVariance / (timeAnalytics.topBottlenecks[0]?.avgEstimatedHours || 1)) * 100)}% would align schedule with actual performance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'parts' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Unique Parts Used</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{partsAnalytics?.totalUniqueParts ?? '—'}</h3>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Package size={20} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Transactions</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{partsAnalytics?.totalPartsTransactions ?? '—'}</h3>
                </div>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={20} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Top Service (Parts Cost)</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1 truncate">{partsAnalytics?.costByServiceType?.[0]?.serviceType ?? '—'}</h3>
                </div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><CalendarCheck size={20} /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Parts by Frequency */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package size={20} className="text-blue-500" /> Most Used Parts
              </h3>
              {partsAnalytics?.topParts?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={partsAnalytics.topParts.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [v, name === 'timesUsed' ? 'Times Used' : name]} />
                    <Bar dataKey="timesUsed" name="Times Used" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <Package size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No parts usage data yet.</p>
                </div>
              )}
            </div>

            {/* Cost by Service Type */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-amber-500" /> Parts Cost by Service
              </h3>
              {partsAnalytics?.costByServiceType?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={partsAnalytics.costByServiceType.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="serviceType" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`R${Number(v).toLocaleString()}`, 'Parts Cost']} />
                    <Bar dataKey="totalPartsCost" name="Total Parts Cost" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <TrendingUp size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No cost data by service yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Stock Turnover Table */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-orange-500" /> Stock Turnover Rate
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Part Name</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-right">In Stock</th>
                    <th className="px-4 py-3 text-right">Total Used</th>
                    <th className="px-4 py-3 text-right">Turnover Rate</th>
                    <th className="px-4 py-3 text-center">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(partsAnalytics?.stockTurnover ?? []).map((part: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{part.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{part.sku}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{part.currentStock}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-600 font-semibold">{part.totalUsed}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        <span className={part.turnoverRate >= 1 ? 'text-green-600' : 'text-gray-500'}>{part.turnoverRate}x</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                          part.isLowStock ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {part.isLowStock ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(partsAnalytics?.stockTurnover?.length) && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No turnover data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* CLV Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Customers</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{clvAnalytics?.summary?.totalCustomers ?? '—'}</h3>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Lifetime Value</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{clvAnalytics?.summary?.avgLifetimeValue != null ? currency(clvAnalytics.summary.avgLifetimeValue) : '—'}</h3>
                </div>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={20} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{clvAnalytics?.summary?.totalRevenue != null ? currency(clvAnalytics.summary.totalRevenue) : '—'}</h3>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">At-Risk Customers</p>
                  <h3 className="text-2xl font-bold text-rose-600 mt-1">{clvAnalytics?.summary?.atRiskCount ?? '—'}</h3>
                </div>
                <div className="p-2 bg-red-50 text-red-500 rounded-lg"><ShieldAlert size={20} /></div>
              </div>
            </div>
          </div>

          {/* Customer Table */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-blue-500" /> Customer Lifetime Value
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-right">Total Spend</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Avg Transaction</th>
                    <th className="px-4 py-3 text-right">Visit Freq.</th>
                    <th className="px-4 py-3 text-right">Last Visit</th>
                    <th className="px-4 py-3 text-center">Churn Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(clvAnalytics?.customers ?? []).slice(0, 20).map((c: any) => (
                    <tr key={c.customerId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{currency(c.totalSpend)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{c.invoiceCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{c.avgTransactionValue > 0 ? currency(c.avgTransactionValue) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{c.visitFrequencyDays != null ? `Every ${c.visitFrequencyDays}d` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {c.lastVisit ? `${c.daysSinceLastVisit}d ago` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                          c.churnRiskLabel === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          c.churnRiskLabel === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          c.churnRiskLabel === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {c.churnRiskLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(clvAnalytics?.customers?.length) && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">No customer value data available. Paid invoices are required.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* === P&L Summary === */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: financialReports.pl?.totals?.revenue, color: 'indigo', icon: <DollarSign size={18}/> },
              { label: 'Total Costs', value: financialReports.pl?.totals?.totalCost, color: 'rose', icon: <TrendingUp size={18}/> },
              { label: 'Gross Profit', value: financialReports.pl?.totals?.grossProfit, color: 'emerald', icon: <Receipt size={18}/> },
              { label: 'Gross Margin', value: financialReports.pl?.totals?.margin, isPercent: true, color: 'blue', icon: <Activity size={18}/> },
            ].map((card) => (
              <div key={card.label} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
                    <h3 className={`text-2xl font-bold mt-1 ${card.color === 'rose' ? 'text-rose-600' : card.color === 'emerald' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {card.value != null ? (card.isPercent ? `${card.value}%` : currency(card.value)) : '—'}
                    </h3>
                  </div>
                  <div className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* === Monthly Revenue Trend === */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-500" /> Monthly Revenue Breakdown
              <span className="ml-auto text-xs font-normal text-gray-400">Rolling 12 months · incl. MoM growth</span>
            </h3>
            {financialReports.monthly?.months?.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={financialReports.monthly.months} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [currency(v), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Month</th>
                        <th className="px-4 py-2 text-right">Revenue</th>
                        <th className="px-4 py-2 text-right">Invoices</th>
                        <th className="px-4 py-2 text-right">Avg Invoice</th>
                        <th className="px-4 py-2 text-right">MoM Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {financialReports.monthly.months.map((row: any) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{row.label}</td>
                          <td className="px-4 py-2 text-right font-semibold">{currency(row.revenue)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{row.invoiceCount}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{row.avgInvoiceValue > 0 ? currency(row.avgInvoiceValue) : '—'}</td>
                          <td className="px-4 py-2 text-right">
                            {row.growth != null ? (
                              <span className={`font-semibold ${row.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {row.growth >= 0 ? '+' : ''}{row.growth}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <TrendingUp size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No revenue data available yet.</p>
              </div>
            )}
          </div>

          {/* === P&L Full Table === */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Receipt size={20} className="text-emerald-500" /> Profit &amp; Loss by Month ({financialReports.pl?.year ?? new Date().getFullYear()})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Parts Cost</th>
                    <th className="px-4 py-2 text-right">Labour Cost</th>
                    <th className="px-4 py-2 text-right">Total Cost</th>
                    <th className="px-4 py-2 text-right">Gross Profit</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(financialReports.pl?.monthly ?? []).map((row: any) => (
                    <tr key={row.month} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{row.month}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">{currency(row.revenue)}</td>
                      <td className="px-4 py-2 text-right text-rose-500">{currency(row.partsCost)}</td>
                      <td className="px-4 py-2 text-right text-rose-400">{currency(row.laborCost)}</td>
                      <td className="px-4 py-2 text-right text-rose-600 font-semibold">{currency(row.totalCost)}</td>
                      <td className={`px-4 py-2 text-right font-bold ${row.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(row.grossProfit)}</td>
                      <td className={`px-4 py-2 text-right text-xs font-semibold ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{row.margin}%</td>
                    </tr>
                  ))}
                  {financialReports.pl?.totals && (
                    <tr className="bg-indigo-50 font-bold text-sm border-t-2 border-indigo-200">
                      <td className="px-4 py-3 text-indigo-900">TOTAL</td>
                      <td className="px-4 py-3 text-right text-indigo-900">{currency(financialReports.pl.totals.revenue)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{currency(financialReports.pl.totals.partsCost)}</td>
                      <td className="px-4 py-3 text-right text-rose-500">{currency(financialReports.pl.totals.laborCost)}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{currency(financialReports.pl.totals.totalCost)}</td>
                      <td className={`px-4 py-3 text-right ${financialReports.pl.totals.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{currency(financialReports.pl.totals.grossProfit)}</td>
                      <td className="px-4 py-3 text-right text-indigo-700">{financialReports.pl.totals.margin}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* === Tax Summary === */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-amber-500" /> VAT / Tax Summary ({financialReports.tax?.year ?? new Date().getFullYear()})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-4 py-2 text-right">Invoices</th>
                    <th className="px-4 py-2 text-right">Subtotal (excl. VAT)</th>
                    <th className="px-4 py-2 text-right">VAT Collected</th>
                    <th className="px-4 py-2 text-right">Total (incl. VAT)</th>
                    <th className="px-4 py-2 text-right">Eff. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(financialReports.tax?.monthly ?? []).map((row: any) => (
                    <tr key={row.month} className={`hover:bg-gray-50 ${row.invoiceCount === 0 ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-800">{row.month}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.invoiceCount}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{currency(row.subtotal)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-amber-600">{currency(row.taxAmount)}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">{currency(row.total)}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{row.effectiveRate}%</td>
                    </tr>
                  ))}
                  {financialReports.tax?.totals && (
                    <tr className="bg-amber-50 font-bold text-sm border-t-2 border-amber-200">
                      <td className="px-4 py-3 text-amber-900">TOTAL</td>
                      <td className="px-4 py-3 text-right text-gray-700">{financialReports.tax.totals.invoiceCount}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{currency(financialReports.tax.totals.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{currency(financialReports.tax.totals.taxAmount)}</td>
                      <td className="px-4 py-3 text-right text-amber-900">{currency(financialReports.tax.totals.total)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{financialReports.tax.totals.effectiveRate}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* === Cost by Service Type === */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarCheck size={20} className="text-blue-500" /> Cost &amp; Margin Analysis by Service Type
            </h3>
            {financialReports.costByService?.services?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Service Type</th>
                      <th className="px-4 py-2 text-right">Jobs</th>
                      <th className="px-4 py-2 text-right">Revenue</th>
                      <th className="px-4 py-2 text-right">Parts Cost</th>
                      <th className="px-4 py-2 text-right">Labour Cost</th>
                      <th className="px-4 py-2 text-right">Total Cost</th>
                      <th className="px-4 py-2 text-right">Gross Profit</th>
                      <th className="px-4 py-2 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {financialReports.costByService.services.map((row: any) => (
                      <tr key={row.serviceType} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{row.serviceType}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{row.jobCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{currency(row.revenue)}</td>
                        <td className="px-4 py-3 text-right text-rose-400">{currency(row.partsCost)}</td>
                        <td className="px-4 py-3 text-right text-rose-300">{currency(row.laborCost)}</td>
                        <td className="px-4 py-3 text-right text-rose-600 font-semibold">{currency(row.totalCost)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${row.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(row.grossProfit)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${row.margin >= 30 ? 'bg-emerald-100 text-emerald-700' : row.margin >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                            {row.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <CalendarCheck size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No service cost data yet. Jobs with parts/labour are needed.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleExportCSV} className="bg-white border px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
          <Download size={16} /> Quick Export CSV
        </button>
      </div>
    </div>
  );
};