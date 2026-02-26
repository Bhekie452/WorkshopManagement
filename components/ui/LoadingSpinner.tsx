import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

const sizeStyles: Record<SpinnerSize, { icon: string; text: string }> = {
  sm: { icon: 'w-4 h-4', text: 'text-xs' },
  md: { icon: 'w-6 h-6', text: 'text-sm' },
  lg: { icon: 'w-10 h-10', text: 'text-base' },
  xl: { icon: 'w-16 h-16', text: 'text-lg' },
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  overlay = false,
}) => {
  const styles = sizeStyles[size];

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${styles.icon} text-blue-600 animate-spin`} />
      {text && (
        <p className={`${styles.text} text-gray-600 dark:text-gray-400 font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-50">
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
