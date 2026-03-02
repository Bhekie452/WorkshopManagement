import React, { useState } from 'react';
import { PaymentMethodSelector, PaymentMethod } from './PaymentMethodSelector';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface PaymentCheckoutProps {
  invoiceNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  onPayment: (method: PaymentMethod, amount: number) => Promise<void>;
  onClose: () => void;
}

export const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  invoiceNumber,
  amount,
  customerName,
  customerEmail,
  onPayment,
  onClose,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('PayFast');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await onPayment(selectedMethod, amount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred while processing payment'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Payment for Invoice</h2>
            <p className="text-sm text-blue-100">{invoiceNumber}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-blue-100 hover:text-white disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">Customer</p>
              <p className="text-sm font-medium text-gray-900">{customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">Email</p>
              <p className="text-sm font-medium text-gray-900">{customerEmail}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-700 font-semibold uppercase mb-2">Amount Due</p>
            <p className="text-3xl font-bold text-blue-900">{formatCurrency(amount)}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 text-sm">Payment Error</p>
                <p className="text-red-800 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <PaymentMethodSelector
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
            disabled={isLoading}
          />

          {/* Terms & Conditions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              By proceeding with payment, you agree to our payment terms and privacy policy.
              Your payment information is securely processed.
            </p>
          </div>

          {/* Payment Button */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <button
              onClick={handlePayment}
              disabled={isLoading || !selectedMethod}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                isLoading || !selectedMethod
                  ? 'bg-gray-400 cursor-not-allowed'
                  : selectedMethod === 'PayFast'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : selectedMethod === 'BankTransfer'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Proceed to {selectedMethod === 'PayFast' ? 'PayFast' : selectedMethod === 'BankTransfer' ? 'Bank Details' : 'Crypto Payment'}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-900 space-y-2">
            <p className="font-semibold">ℹ️ Payment Information</p>
            <ul className="space-y-1">
              {selectedMethod === 'PayFast' && (
                <>
                  <li>✓ You will be redirected to PayFast's secure payment page</li>
                  <li>✓ Your payment will be processed immediately</li>
                  <li>✓ You will receive a confirmation email</li>
                </>
              )}
              {selectedMethod === 'BankTransfer' && (
                <>
                  <li>✓ Banking details will be displayed after confirming</li>
                  <li>✓ Payment will be verified within 24 hours</li>
                  <li>✓ Please include invoice number as reference</li>
                </>
              )}
              {selectedMethod === 'Crypto' && (
                <>
                  <li>✓ You will receive a crypto wallet address</li>
                  <li>✓ Payment confirmation via blockchain</li>
                  <li>✓ Contact support for more details</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
