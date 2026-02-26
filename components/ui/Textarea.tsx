import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  fullWidth = false,
  className = '',
  id,
  rows = 4,
  ...props
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`
          block rounded-xl border bg-white dark:bg-gray-900
          text-gray-900 dark:text-white
          placeholder-gray-400 dark:placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-colors duration-200
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
          resize-none
          px-4 py-3 text-sm
          ${error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="mt-1.5 text-sm text-red-500">{error}</p>
      )}

      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
