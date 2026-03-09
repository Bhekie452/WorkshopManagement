import React, { useEffect, useState } from 'react';
import { Building2, Users, Briefcase, BarChart2, RefreshCw, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight, Activity, DollarSign, FileText, AlertCircle } from 'lucide-react';

const currency = (v: number) => `R${Math.round(v).toLocaleString()}`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

type SubView = 'dashboard' | 'companies' | 'report';

export const SystemAdmin: React.FC = () => {
  const [subView, setSubView] = useState<SubView>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', { headers: getAuthHeaders() });
      if (res.ok) setDashboard(await res.json());
      else setError('Access denied — SYSTEM_ADMIN role required.');
    } catch { setError('Unable to reach admin API.'); }
  };

  const fetchCompanies = async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (search) params.set('search', search);
    if (filterActive !== 'all') params.set('is_active', filterActive === 'active' ? 'true' : 'false');
    const res = await fetch(`/api/admin/companies?${params}`, { headers: getAuthHeaders() });
    if (res.ok) setCompanies((await res.json()).companies ?? []);
  };

  const fetchReport = async () => {
    const res = await fetch('/api/admin/system-report', { headers: getAuthHeaders() });
    if (res.ok) setReport((await res.json()).companies ?? []);
  };

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([fetchDashboard(), fetchCompanies(), fetchReport()]);
    setIsLoading(false);
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { fetchCompanies(); }, [search, filterActive]);

  const toggleCompany = async (id: string) => {
    await fetch(`/api/admin/companies/${id}/toggle-active`, { method: 'POST', headers: getAuthHeaders() });
    fetchCompanies();
    fetchDashboard();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-lg font-semibold text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={26} className="text-indigo-600" /> System Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Master control panel — SYSTEM_ADMIN only.</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Sub-nav */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {([['dashboard', 'Dashboard'], ['companies', 'All Companies'], ['report', 'System Report']] as [SubView, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSubView(key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-all ${subView === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard */}
      {subView === 'dashboard' && dashboard && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Companies', value: dashboard.totalCompanies, icon: <Building2 size={20}/>, color: 'indigo' },
              { label: 'Active Companies', value: dashboard.activeCompanies, icon: <Activity size={20}/>, color: 'emerald' },
              { label: 'Total Users', value: dashboard.totalUsers, icon: <Users size={20}/>, color: 'blue' },
              { label: 'System Revenue', value: currency(dashboard.totalRevenue), icon: <DollarSign size={20}/>, color: 'amber' },
            ].map(card => (
              <div key={card.label} className="bg-white p-5 rounded-xl border shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">{card.label}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{card.value}</h3>
                  </div>
                  <div className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Briefcase size={18} className="text-indigo-500"/> Subscription Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(dashboard.subscriptionBreakdown ?? {}).map(([tier, count]) => (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium capitalize text-gray-700">{tier}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${((count as number) / dashboard.totalCompanies) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-6 text-right">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FileText size={18} className="text-gray-500"/> System Totals</h3>
              <div className="space-y-2">
                {[
                  ['Total Jobs', dashboard.totalJobs],
                  ['Total Invoices', dashboard.totalInvoices],
                  ['Audit Log Entries', dashboard.auditLogCount],
                  ['Inactive Companies', dashboard.inactiveCompanies],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Companies List */}
      {subView === 'companies' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Subscription</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-center">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {companies.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 capitalize">{c.subscription}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200"><ShieldCheck size={12}/> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200"><ShieldOff size={12}/> Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleCompany(c.id)} title={c.is_active ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${c.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {c.is_active ? <ToggleRight size={22}/> : <ToggleLeft size={22}/>}
                      </button>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No companies found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Report */}
      {subView === 'report' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-right">Users</th>
                  <th className="px-4 py-3 text-right">Jobs</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.map((r: any) => (
                  <tr key={r.companyId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                    <td className="px-4 py-3"><span className="capitalize text-indigo-600 text-xs font-semibold">{r.subscription}</span></td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.users}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.jobs}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.invoices}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{currency(r.revenue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.isActive ? 'Active' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
