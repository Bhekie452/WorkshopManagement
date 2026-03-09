import React, { useState } from 'react';
import { Search, Filter, Calendar, X, Tag } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface PresetFilter {
  label: string;
  onClick: () => void;
  active?: boolean;
}

interface AdvancedFilterPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filters: FilterGroup[];
  presets?: PresetFilter[];
  onClearFilters: () => void;
  placeholder?: string;
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  searchTerm,
  onSearchChange,
  filters,
  presets = [],
  onClearFilters,
  placeholder = "Search..."
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if any filter is active (not 'all')
  const hasActiveFilters = filters.some(f => f.value !== 'all') || searchTerm.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      {/* Top Bar - Search & Toggle */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center sm:items-stretch">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant={isExpanded ? 'primary' : 'outline'}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2"
          >
            <Filter size={16} /> 
            <span>Filters</span>
            {hasActiveFilters && !isExpanded && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-1" />
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClearFilters} className="text-gray-500 hover:text-rose-500">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Advanced Filters */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'
        }`}
      >
        <div className="p-4 md:p-6 bg-gray-50/50 dark:bg-gray-800/50">
          
          {/* Presets */}
          {presets.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Filters</h4>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={preset.onClick}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      preset.active 
                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Tag size={12} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Attributes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map((group) => (
                <div key={group.id} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{group.label}</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-blue-500 dark:text-white"
                    value={group.value}
                    onChange={(e) => group.onChange(e.target.value)}
                  >
                    {group.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
