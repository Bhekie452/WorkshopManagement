import React from 'react';
import { CreditCard, Heart, Wallet } from 'lucide-react';

export type PaymentMethod = 'PayFast' | 'BankTransfer' | 'Crypto';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'PayFast',
    label: 'PayFast',
    description: 'Fast, secure online payment via card, EFT, or mobile wallet',
    icon: <CreditCard className="w-6 h-6" />,
    badge: 'Recommended',
  },
  {
    id: 'BankTransfer',
    label: 'Bank Transfer',
    description: 'Direct deposit to workshop bank account (manual verification)',
    icon: <Wallet className="w-6 h-6" />,
  },
  {
    id: 'Crypto',
    label: 'Cryptocurrency',
    description: 'Bitcoin, Ethereum, or other accepted cryptocurrencies (beta)',
    icon: <Heart className="w-6 h-6" />,
  },
];

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelect,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-900 mb-4">
        Select Payment Method
      </label>
      <div className="grid grid-cols-1 gap-3">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method.id}
            onClick={() => !disabled && onSelect(method.id)}
            disabled={disabled}
            className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
              selectedMethod === method.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Radio button */}
            <div
              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-1 ${
                selectedMethod === method.id
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-300'
              }`}
            >
              {selectedMethod === method.id && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{method.label}</span>
                {method.badge && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {method.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">{method.description}</p>
            </div>

            {/* Icon */}
            <div
              className={`flex-shrink-0 ${
                selectedMethod === method.id ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {method.icon}
            </div>
          </button>
        ))}
      </div>

      {/* Method-specific info */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
        {selectedMethod === 'PayFast' && (
          <div>
            <h4 className="font-semibold text-blue-900 text-sm mb-2">PayFast Payment</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Accepts all major credit cards</li>
              <li>✓ Secure encrypted transmission</li>
              <li>✓ Instant payment confirmation</li>
              <li>✓ Supports EFT payments</li>
            </ul>
          </div>
        )}
        {selectedMethod === 'BankTransfer' && (
          <div>
            <h4 className="font-semibold text-blue-900 text-sm mb-2">Bank Transfer</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Direct payment to workshop account</li>
              <li>✓ Lower transaction fees</li>
              <li>✓ Payment verification required</li>
              <li>✓ Banking details will be provided</li>
            </ul>
          </div>
        )}
        {selectedMethod === 'Crypto' && (
          <div>
            <h4 className="font-semibold text-blue-900 text-sm mb-2">Cryptocurrency</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Bitcoin and Ethereum accepted</li>
              <li>✓ Blockchain-verified transactions</li>
              <li>✓ Instant settlement</li>
              <li>✓ Beta feature - contact support for details</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
