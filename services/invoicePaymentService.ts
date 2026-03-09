/**
 * Invoice Payment Service
 * Handles payment history, refunds, and payment reminders
 */

import { ApiCall } from './api';

export interface PaymentTransaction {
  id: string;
  invoice_id: string;
  payment_id: string;
  pf_payment_id?: string;
  amount: number;
  amount_gross?: number;
  amount_fee?: number;
  amount_net?: number;
  status: 'Pending' | 'Complete' | 'Failed' | 'Cancelled';
  payment_method?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  retry_count?: number;
  signature_valid?: boolean;
}

export interface PaymentHistoryResponse {
  invoices: PaymentTransaction[];
  count: number;
}

export class InvoicePaymentService {
  /**
   * Get payment history for an invoice
   */
  static async getPaymentHistory(invoiceId: string): Promise<PaymentTransaction[]> {
    try {
      const data = await ApiCall.get<PaymentTransaction[]>(`/api/payment/history/${invoiceId}`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  }

  /**
   * Send a refund for a payment
   */
  static async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const data = await ApiCall.post<{ message: string }>('/api/payment/refund', {
        payment_id: paymentId,
        amount,
        reason,
      });

      return {
        success: true,
        message: data.message || 'Payment refunded successfully',
      };
    } catch (error) {
      console.error('Error refunding payment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to refund payment',
      };
    }
  }

  /**
   * Send a payment reminder for an invoice
   */
  static async sendPaymentReminder(invoiceId: string): Promise<{
    success: boolean;
    email_sent: boolean;
    sms_sent: boolean;
    message?: string;
  }> {
    try {
      const data = await ApiCall.post<{ email_sent: boolean; sms_sent: boolean }>(
        `/api/invoices/${invoiceId}/reminder`,
        {}
      );

      return {
        success: true,
        email_sent: data.email_sent || false,
        sms_sent: data.sms_sent || false,
        message: 'Reminder sent successfully',
      };
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return {
        success: false,
        email_sent: false,
        sms_sent: false,
        message: error instanceof Error ? error.message : 'Failed to send reminder',
      };
    }
  }

  /**
   * Format a payment transaction for display
   */
  static formatTransaction(transaction: PaymentTransaction): string {
    const date = new Date(transaction.created_at).toLocaleDateString();
    const status = transaction.status;
    const amount = `R${transaction.amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    })}`;
    return `${date} - ${status} - ${amount}`;
  }

  /**
   * Get payment status color
   */
  static getStatusColor(
    status: string
  ): string {
    switch (status) {
      case 'Complete':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Calculate total paid amount from payment history
   */
  static calculateTotalPaid(transactions: PaymentTransaction[]): number {
    return transactions
      .filter((t) => t.status === 'Complete')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Check if invoice has pending payments
   */
  static hasPendingPayment(transactions: PaymentTransaction[]): boolean {
    return transactions.some((t) => t.status === 'Pending');
  }

  /**
   * Get latest payment transaction
   */
  static getLatestTransaction(
    transactions: PaymentTransaction[]
  ): PaymentTransaction | null {
    if (transactions.length === 0) return null;
    return transactions.reduce((latest, current) => {
      const latestDate = new Date(latest.created_at).getTime();
      const currentDate = new Date(current.created_at).getTime();
      return currentDate > latestDate ? current : latest;
    });
  }
}

export const invoicePaymentService = InvoicePaymentService;
