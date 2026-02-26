import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'button' | 'dropdown';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  showLabel = false,
  variant = 'button' 
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'dropdown') {
    return (
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setTheme('light')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'light' 
              ? 'bg-white dark:bg-gray-700 shadow text-yellow-500' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Light mode"
        >
          <Sun size={16} />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'dark' 
              ? 'bg-white dark:bg-gray-700 shadow text-blue-500' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Dark mode"
        >
          <Moon size={16} />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'system' 
              ? 'bg-white dark:bg-gray-700 shadow text-purple-500' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="System preference"
        >
          <Monitor size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {resolvedTheme === 'light' ? (
        <Moon size={20} />
      ) : (
        <Sun size={20} />
      )}
      {showLabel && (
        <span className="text-sm">
          {resolvedTheme === 'light' ? 'Dark' : 'Light'} mode
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
