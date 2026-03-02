import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { ApiCall } from '../services/api';

interface AgingInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  status: string;
}

interface AgeGroup {
  label: string;
  min_days: number;
  max_days: number;
  count: number;
  total_amount: number;
}

interface AgingReport {
  generated_at: string;
  total_overdue_amount: number;
  total_overdue_count: number;
  age_groups: AgeGroup[];
  invoices: AgingInvoice[];
}

export default function InvoiceAging() {
  const { currentUser } = useAuth();
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'days_overdue' | 'amount'>('days_overdue');

  useEffect(() => {
    fetchAgingReport();
  }, []);

  const fetchAgingReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await ApiCall.get('/api/analytics/invoices/aging');
      if (!response.ok) {
        throw new Error('Failed to fetch aging report');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching aging report:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  const getSortedInvoices = () => {
    if (!report) return [];
    const sorted = [...report.invoices];
    if (sortBy === 'days_overdue') {
      sorted.sort((a, b) => b.days_overdue - a.days_overdue);
    } else {
      sorted.sort((a, b) => b.amount - a.amount);
    }
    return sorted;
  };

  const getAgeGroupColor = (label: string) => {
    if (label.includes('0-30')) return 'bg-yellow-50 border-yellow-200';
    if (label.includes('31-60')) return 'bg-orange-50 border-orange-200';
    if (label.includes('61-90')) return 'bg-red-50 border-red-200';
    return 'bg-red-100 border-red-300';
  };

  const getAgeGroupBadgeColor = (label: string) => {
    if (label.includes('0-30')) return 'bg-yellow-100 text-yellow-800';
    if (label.includes('31-60')) return 'bg-orange-100 text-orange-800';
    if (label.includes('61-90')) return 'bg-red-100 text-red-800';
    return 'bg-red-200 text-red-900';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error}</p>
          <Button onClick={fetchAgingReport} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!report || report.invoices.length === 0) {
    return (
      <EmptyState
        title="No Overdue Invoices"
        description="Great news! All invoices are paid or not yet due."
        action={
          <Button onClick={fetchAgingReport} variant="secondary">
            Refresh
          </Button>
        }
      />
    );
  }

  const sortedInvoices = getSortedInvoices();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Aging Report</h1>
        <p className="text-gray-600">
          Last updated: {formatDate(report.generated_at)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Total Overdue Amount */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Overdue Amount</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {formatCurrency(report.total_overdue_amount)}
              </p>
            </div>
            <div className="text-4xl text-red-200">💰</div>
          </div>
        </div>

        {/* Total Overdue Count */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Overdue Invoices</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {report.total_overdue_count}
              </p>
            </div>
            <div className="text-4xl text-orange-200">📋</div>
          </div>
        </div>
      </div>

      {/* Age Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {report.age_groups.map((group) => (
          <div
            key={group.label}
            className={`border rounded-lg p-6 ${getAgeGroupColor(group.label)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{group.label}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAgeGroupBadgeColor(group.label)}`}>
                {group.count} invoice{group.count !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(group.total_amount)}
            </p>
          </div>
        ))}
      </div>

      {/* Detailed Invoices Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Overdue Invoices</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('days_overdue')}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                sortBy === 'days_overdue'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sort by Days Overdue
            </button>
            <button
              onClick={() => setSortBy('amount')}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                sortBy === 'amount'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sort by Amount
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Days Overdue
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(invoice.due_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      invoice.days_overdue > 90 ? 'bg-red-100 text-red-800' :
                      invoice.days_overdue > 60 ? 'bg-red-50 text-red-700' :
                      invoice.days_overdue > 30 ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invoice.days_overdue} days
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button onClick={fetchAgingReport} variant="secondary">
          Refresh Report
        </Button>
        <Button variant="secondary">
          Export to CSV
        </Button>
      </div>
    </div>
  );
}
