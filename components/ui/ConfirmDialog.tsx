import React from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  variant?: ConfirmDialogVariant;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

const variantConfig: Record<ConfirmDialogVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmVariant: 'danger' | 'primary' | 'success';
}> = {
  danger: {
    icon: <XCircle className="w-6 h-6 text-red-600" />,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    confirmVariant: 'danger',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    confirmVariant: 'primary',
  },
  info: {
    icon: <Info className="w-6 h-6 text-blue-600" />,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    confirmVariant: 'primary',
  },
  success: {
    icon: <CheckCircle className="w-6 h-6 text-green-600" />,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    confirmVariant: 'success',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
}) => {
  const config = variantConfig[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
    >
      <div className="text-center">
        <div className={`mx-auto w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
          {config.icon}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
