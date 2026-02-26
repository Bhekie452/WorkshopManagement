import React from 'react';
import { Inbox, Search, FileX, AlertCircle, Plus } from 'lucide-react';
import { Button } from './Button';

export type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-data';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  title: string;
  description: string;
}> = {
  default: {
    icon: <Inbox className="w-12 h-12" />,
    title: 'No items yet',
    description: 'Get started by creating your first item.',
  },
  search: {
    icon: <Search className="w-12 h-12" />,
    title: 'No results found',
    description: 'Try adjusting your search or filter to find what you\'re looking for.',
  },
  error: {
    icon: <AlertCircle className="w-12 h-12" />,
    title: 'Something went wrong',
    description: 'There was an error loading this content. Please try again.',
  },
  'no-data': {
    icon: <FileX className="w-12 h-12" />,
    title: 'No data available',
    description: 'There\'s no data to display at the moment.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'default',
  title,
  description,
  icon,
  action,
}) => {
  const config = variantConfig[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-gray-300 dark:text-gray-600 mb-4">
        {icon || config.icon}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title || config.title}
      </h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {description || config.description}
      </p>

      {action && (
        <Button
          onClick={action.onClick}
          icon={<Plus size={18} />}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
