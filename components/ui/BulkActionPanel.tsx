import React from 'react';
import { X } from 'lucide-react';

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface BulkActionPanelProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
}

export const BulkActionPanel: React.FC<BulkActionPanelProps> = ({
  selectedCount,
  actions,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 border border-gray-700 shadow-2xl rounded-full px-6 py-3 animate-in fade-in slide-in-from-bottom-8 duration-300">
      <div className="flex items-center gap-2 border-r border-gray-700 pr-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
          {selectedCount}
        </span>
        <span className="text-sm font-semibold text-white">selected</span>
      </div>
      
      <div className="flex items-center gap-2">
        {actions.map((action, index) => {
          const variantClasses = {
            primary: 'bg-blue-600 hover:bg-blue-700 text-white',
            secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200',
            danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300',
          };
          const btnClass = variantClasses[action.variant || 'secondary'];
          return (
            <button
              key={index}
              onClick={action.onClick}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${btnClass}`}
            >
              {action.icon}
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="border-l border-gray-700 pl-4">
        <button
          onClick={onClearSelection}
          className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
