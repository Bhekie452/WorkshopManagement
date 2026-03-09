import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  hoverable = true,
  compact = false,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    const key = String(column.key);
    if (sortKey === key) {
      setSortDirection(prev =>
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(sortedData.map(keyExtractor));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedKeys, key]);
    } else {
      onSelectionChange(selectedKeys.filter(k => k !== key));
    }
  };

  const isAllSelected = sortedData.length > 0 && selectedKeys.length === sortedData.length;
  const isIndeterminate = selectedKeys.length > 0 && selectedKeys.length < sortedData.length;

  const SortIcon = ({ column }: { column: Column<T> }) => {
    if (!column.sortable) return null;
    if (sortKey !== String(column.key)) {
      return <ChevronsUpDown size={14} className="text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-blue-600" />
    ) : (
      <ChevronDown size={14} className="text-blue-600" />
    );
  };

  const getCellValue = (item: T, column: Column<T>, index: number) => {
    if (column.render) {
      return column.render(item, index);
    }
    const value = (item as any)[column.key];
    return value ?? '-';
  };

  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {selectable && (
              <th className={`w-12 text-center ${compact ? 'px-4 py-2' : 'px-6 py-3'}`}>
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={isAllSelected}
                  ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`
                  ${compact ? 'px-4 py-2' : 'px-6 py-3'}
                  text-xs font-semibold uppercase tracking-wider
                  text-gray-500 dark:text-gray-400
                  ${alignStyles[column.align || 'left']}
                  ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                `}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
              >
                <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                  {column.header}
                  <SortIcon column={column} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => {
              const rowKey = keyExtractor(item);
              const isSelected = selectedKeys.includes(rowKey);
              return (
              <tr
                key={rowKey}
                onClick={(e) => {
                  // Prevent row click if clicking on checkbox or its cell
                  if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
                  if ((e.target as HTMLElement).closest('.selection-cell')) return;
                  onRowClick?.(item);
                }}
                className={`
                  bg-white dark:bg-gray-900
                  ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : striped && index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                  ${hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                  ${onRowClick ? 'cursor-pointer' : ''}
                  transition-colors
                `}
              >
                {selectable && (
                  <td className={`selection-cell text-center ${compact ? 'px-4 py-2' : 'px-6 py-4'}`} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isSelected}
                      onChange={(e) => handleSelectRow(rowKey, e.target.checked)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`
                      ${compact ? 'px-4 py-2' : 'px-6 py-4'}
                      text-sm text-gray-900 dark:text-gray-100
                      ${alignStyles[column.align || 'left']}
                    `}
                  >
                    {getCellValue(item, column, index)}
                  </td>
                ))}
              </tr>
            )})
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
