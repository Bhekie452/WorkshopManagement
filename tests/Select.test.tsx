/**
 * Select Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../components/ui';

const mockOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3', disabled: true },
];

describe('Select Component', () => {
  it('renders select element', () => {
    render(<Select options={mockOptions} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select options={mockOptions} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('renders placeholder option', () => {
    render(<Select options={mockOptions} placeholder="Select an option" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Select options={mockOptions} label="Choose Option" />);
    expect(screen.getByText('Choose Option')).toBeInTheDocument();
  });

  it('associates label with select', () => {
    render(<Select options={mockOptions} label="Type" id="type-select" />);
    const label = screen.getByText('Type');
    const select = screen.getByRole('combobox');
    expect(label).toHaveAttribute('for', 'type-select');
    expect(select).toHaveAttribute('id', 'type-select');
  });

  it('displays error message', () => {
    render(<Select options={mockOptions} error="Selection required" />);
    expect(screen.getByText('Selection required')).toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    render(<Select options={mockOptions} error="Error" />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('border-red-500');
  });

  it('displays hint text', () => {
    render(<Select options={mockOptions} hint="Choose wisely" />);
    expect(screen.getByText('Choose wisely')).toBeInTheDocument();
  });

  it('hides hint when error is shown', () => {
    render(<Select options={mockOptions} hint="Hint" error="Error" />);
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('applies size styles', () => {
    const { rerender } = render(<Select options={mockOptions} selectSize="sm" />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('text-sm');
    expect(select.className).toContain('py-1.5');

    rerender(<Select options={mockOptions} selectSize="lg" />);
    expect(screen.getByRole('combobox').className).toContain('text-base');
  });

  it('applies full width', () => {
    render(<Select options={mockOptions} fullWidth />);
    expect(screen.getByRole('combobox').className).toContain('w-full');
  });

  it('respects disabled state', () => {
    render(<Select options={mockOptions} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<Select options={mockOptions} onChange={handleChange} />);
    
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'option2' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('disables individual options', () => {
    render(<Select options={mockOptions} />);
    const disabledOption = screen.getByText('Option 3');
    expect(disabledOption).toHaveAttribute('disabled');
  });

  it('applies custom className', () => {
    render(<Select options={mockOptions} className="custom-select" />);
    expect(screen.getByRole('combobox').className).toContain('custom-select');
  });

  it('forwards ref to select element', () => {
    const ref = { current: null };
    render(<Select options={mockOptions} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('has chevron icon', () => {
    render(<Select options={mockOptions} />);
    // ChevronDown renders as an SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
