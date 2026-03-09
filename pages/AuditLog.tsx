import React, { useEffect, useState } from 'react';
import { Shield, Search, RefreshCw, Filter, AlertCircle, ChevronRight, Clock } from 'lucide-react';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ACTION_COLORS: Record<string, string> = {
  create:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  update:   'bg-blue-50 text-blue-700 border-blue-200',
  delete:   'bg-red-50 text-red-700 border-red-200',
  login:    'bg-amber-50 text-amber-700 border-amber-200',
  logout:   'bg-gray-100 text-gray-600 border-gray-200',
  activate_company:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  deactivate_company: 'bg-red-50 text-red-700 border-red-200',
  permission_change:  'bg-purple-50 text-purple-700 border-purple-200',
};

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (filterAction) params.set('action', filterAction);
      if (filterResource) params.set('resource_type', filterResource);
      const res = await fetch(`/api/audit-logs?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) { setError('Unable to load audit logs.'); return; }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch { setError('Network error.'); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterResource]);

  const visibleLogs = search
    ? logs.filter(l =>
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.resource_type?.toLowerCase().includes(search.toLowerCase()) ||
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.resource_id?.includes(search)
      )
    : logs;

  const actionTag = (action: string) => (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {action}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={26} className="text-indigo-600" /> Audit Trail
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete history of every system action. {total.toLocaleString()} total entries.
          </p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] border rounded-lg px-3 py-2 bg-gray-50">
          <Search size={14} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, action, resource…"
            className="bg-transparent outline-none text-sm flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Actions</option>
            {['create', 'update', 'delete', 'login', 'logout', 'activate_company', 'deactivate_company', 'permission_change'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={filterResource} onChange={e => { setFilterResource(e.target.value); setPage(0); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Resources</option>
            {['job', 'invoice', 'customer', 'user', 'company', 'vehicle', 'part'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Resource</th>
              <th className="px-4 py-3 text-left">Resource ID</th>
              <th className="px-4 py-3 text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleLogs.map(log => (
              <React.Fragment key={log.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1"><Clock size={12}/> {new Date(log.timestamp).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{log.user_name || '—'}</p>
                    <p className="text-gray-400 text-xs font-mono truncate max-w-[120px]">{log.user_id}</p>
                  </td>
                  <td className="px-4 py-3">{actionTag(log.action)}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium capitalize">{log.resource_type}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[140px]">{log.resource_id ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {log.changes ? (
                      <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors">
                        <ChevronRight size={16} className={`transition-transform ${expandedId === log.id ? 'rotate-90' : ''}`} />
                      </button>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
                {expandedId === log.id && log.changes && (
                  <tr className="bg-indigo-50">
                    <td colSpan={6} className="px-6 py-3">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">Change Details</p>
                      <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 border border-indigo-100 overflow-x-auto max-h-40">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                      {log.ip_address && <p className="text-xs text-gray-400 mt-1">IP: {log.ip_address}</p>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {visibleLogs.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                <Shield size={32} className="mx-auto mb-2 opacity-20" />
                No audit log entries found.
              </td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50 text-sm">
            <span className="text-gray-500">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg border bg-white text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-40">← Prev</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg border bg-white text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
