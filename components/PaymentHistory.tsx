import React, { useState, useEffect } from 'react';
import { invoicePaymentService, PaymentTransaction } from '../services/invoicePaymentService';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface PaymentHistoryProps {
  invoiceId: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ invoiceId }) => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentHistory();
  }, [invoiceId]);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoicePaymentService.getPaymentHistory(invoiceId);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'Failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'Cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error loading payment history</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No payment history</p>
        <p className="text-sm">No payment transactions have been recorded for this invoice.</p>
      </div>
    );
  }

  // Calculate totals
  const completedTransactions = transactions.filter((t) => t.status === 'Complete');
  const totalPaid = invoicePaymentService.calculateTotalPaid(transactions);
  const hasPending = invoicePaymentService.hasPendingPayment(transactions);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Paid</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Payment Attempts</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{transactions.length}</p>
        </div>
      </div>

      {/* Warning for pending payments */}
      {hasPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900 text-sm">Pending Payment</p>
            <p className="text-yellow-800 text-sm">This invoice has a pending payment that is awaiting completion.</p>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
          Transaction History
        </h3>
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3 flex-1">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(transaction.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {transaction.payment_method || 'Payment'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${invoicePaymentService.getStatusColor(
                        transaction.status
                      )}`}
                    >
                      {transaction.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Date: {formatDate(transaction.created_at)}</p>
                    {transaction.pf_payment_id && (
                      <p>PayFast ID: {transaction.pf_payment_id}</p>
                    )}
                    {transaction.error_message && (
                      <p className="text-red-600">Error: {transaction.error_message}</p>
                    )}
                    {transaction.retry_count && transaction.retry_count > 0 && (
                      <p className="text-orange-600">
                        Retry attempts: {transaction.retry_count}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(transaction.amount)}
                </p>
                {transaction.amount_fee !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">
                    Fee: {formatCurrency(Math.abs(transaction.amount_fee))}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completed transactions summary */}
      {completedTransactions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <p className="text-sm font-semibold text-green-900">
            {completedTransactions.length} successful payment{completedTransactions.length !== 1 ? 's' : ''}
          </p>
          <p className="text-green-800 text-sm mt-1">
            Total received: {formatCurrency(totalPaid)}
          </p>
        </div>
      )}
    </div>
  );
};
