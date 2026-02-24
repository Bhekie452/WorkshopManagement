
import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { 
  Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, 
  User, MapPin, Repeat, AlignJustify, Grid3X3, Columns, LayoutList, X, Check
} from 'lucide-react';
import { Appointment, Customer, Vehicle } from '../types';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

export const Schedule: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Appointment>>({
    type: 'Service',
    status: 'Scheduled',
    recurrence: 'None',
    start: new Date().toISOString(),
    end: new Date(new Date().setHours(new Date().getHours() + 1)).toISOString()
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setAppointments(store.getAppointments());
    setCustomers(store.getCustomers());
    setVehicles(store.getVehicles());
  };

  // --- NAVIGATION HELPERS ---

  const next = () => {
    const date = new Date(currentDate);
    if (viewMode === 'month') date.setMonth(date.getMonth() + 1);
    else if (viewMode === 'week') date.setDate(date.getDate() + 7);
    else date.setDate(date.getDate() + 1);
    setCurrentDate(date);
  };

  const prev = () => {
    const date = new Date(currentDate);
    if (viewMode === 'month') date.setMonth(date.getMonth() - 1);
    else if (viewMode === 'week') date.setDate(date.getDate() - 7);
    else date.setDate(date.getDate() - 1);
    setCurrentDate(date);
  };

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    if (viewMode === 'day') options.day = 'numeric';
    return currentDate.toLocaleDateString('default', options);
  };

  // --- DATA FILTERING ---

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'Service': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Inspection': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Repair': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isSameDate = (d1: Date, d2: Date) => 
    d1.getDate() === d2.getDate() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getFullYear() === d2.getFullYear();

  // --- EVENT HANDLERS ---

  const handleCreate = () => {
    const start = new Date(currentDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    
    setFormData({
      type: 'Service',
      status: 'Scheduled',
      recurrence: 'None',
      start: start.toISOString(),
      end: end.toISOString()
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.customerId) return;
    
    store.addAppointment(formData as Appointment);
    setIsModalOpen(false);
    refreshData();
  };

  // --- VIEWS ---

  const MonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = [];

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-gray-50/50 border-r border-b border-gray-100" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = isSameDate(date, new Date());
      const dayAppts = appointments.filter(a => isSameDate(new Date(a.start), date));

      days.push(
        <div key={day} className={`min-h-[100px] border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50 ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
              {day}
            </span>
          </div>
          <div className="space-y-1">
            {dayAppts.map(apt => (
              <div key={apt.id} className={`text-xs px-2 py-1 rounded truncate border ${getTypeStyle(apt.type)}`}>
                 <div className="flex items-center gap-1">
                    {apt.recurrence !== 'None' && <Repeat size={8} />}
                    <span className="font-semibold">{new Date(apt.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className="truncate">{apt.title}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
             <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>
           ))}
        </div>
        <div className="grid grid-cols-7 border-l border-t border-gray-100">
           {days}
        </div>
      </div>
    );
  };

  const TimeGridView = ({ mode }: { mode: 'week' | 'day' }) => {
    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00 to 18:00
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff); // Set to Monday
    // If mode is day, we just use currentDate, else we loop 7 days from Monday

    const daysToShow = mode === 'week' 
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        })
        : [currentDate];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
         <div className="min-w-[800px]">
            {/* Header */}
            <div className="flex border-b border-gray-200">
                <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200"></div>
                {daysToShow.map(day => (
                    <div key={day.toISOString()} className={`flex-1 py-3 text-center border-r border-gray-200 ${isSameDate(day, new Date()) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="text-xs text-gray-500 uppercase font-bold">{day.toLocaleDateString('default', { weekday: 'short' })}</div>
                        <div className={`text-lg font-bold ${isSameDate(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</div>
                    </div>
                ))}
            </div>

            {/* Grid Body */}
            <div className="relative">
                {hours.map(hour => (
                    <div key={hour} className="flex h-16 border-b border-gray-100">
                        <div className="w-16 flex-shrink-0 flex items-start justify-center pt-2 text-xs text-gray-400 bg-white border-r border-gray-200">
                            {hour}:00
                        </div>
                        {daysToShow.map(day => (
                            <div key={day.toISOString()} className="flex-1 border-r border-gray-100 relative group hover:bg-gray-50/50">
                                {/* Click to add slot logic would go here */}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Absolute Events */}
                {daysToShow.map((day, colIndex) => {
                    const dayAppts = appointments.filter(a => isSameDate(new Date(a.start), day));
                    return dayAppts.map(apt => {
                        const start = new Date(apt.start);
                        const end = new Date(apt.end);
                        const startHour = start.getHours();
                        const startMin = start.getMinutes();
                        const durationHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        
                        // 64px is height of one hour row
                        const top = ((startHour - 8) * 64) + ((startMin / 60) * 64);
                        const height = durationHrs * 64;

                        // Skip if out of business hours (simple check)
                        if (startHour < 8 || startHour > 18) return null;

                        return (
                            <div 
                                key={apt.id}
                                className={`absolute rounded px-2 py-1 text-xs border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getTypeStyle(apt.type)}`}
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: `calc(4rem + (${colIndex} * ((100% - 4rem) / ${daysToShow.length})) + 2px)`,
                                    width: `calc(((100% - 4rem) / ${daysToShow.length}) - 4px)`
                                }}
                            >
                                <div className="font-bold flex items-center gap-1">
                                    {apt.recurrence !== 'None' && <Repeat size={10} />}
                                    {start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </div>
                                <div className="font-semibold truncate">{apt.title}</div>
                                {mode === 'day' && <div className="mt-1 opacity-75 truncate">{apt.type}</div>}
                            </div>
                        )
                    });
                })}
            </div>
         </div>
      </div>
    );
  };

  const AgendaView = () => {
    // Group by Date
    const sorted = [...appointments].sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    // Simplistic grouping
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {sorted.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No upcoming appointments found.</div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {sorted.map(apt => {
                        const date = new Date(apt.start);
                        const customer = customers.find(c => c.id === apt.customerId);
                        const vehicle = vehicles.find(v => v.id === apt.vehicleId);
                        
                        return (
                            <div key={apt.id} className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row gap-4 sm:items-center">
                                <div className="min-w-[120px] text-center sm:text-left">
                                    <div className="font-bold text-gray-900 text-lg">{date.getDate()} {date.toLocaleDateString('default', {month:'short'})}</div>
                                    <div className="text-sm text-gray-500">{date.toLocaleDateString('default', {weekday:'long'})}</div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded border ${getTypeStyle(apt.type)}`}>{apt.type}</span>
                                        <span className="text-sm font-bold text-gray-900">{apt.title}</span>
                                        {apt.recurrence !== 'None' && <Repeat size={14} className="text-gray-400" />}
                                    </div>
                                    <div className="text-sm text-gray-600 flex items-center gap-4">
                                        <span className="flex items-center gap-1"><Clock size={14}/> {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(apt.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                        <span className="flex items-center gap-1"><User size={14}/> {customer?.name || 'Unknown'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                     <button className="text-sm text-blue-600 font-medium hover:underline">View Details</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
  };

  return (
    <div className="space-y-6">
      {/* --- HEADER --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
           <p className="text-sm text-gray-500">Manage technician time and service bookings</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
             {/* Navigation */}
             <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 items-center">
                <button onClick={prev} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ChevronLeft size={20} /></button>
                <button onClick={goToToday} className="px-3 py-1 text-sm font-medium hover:bg-gray-100 rounded text-gray-700 mx-1">Today</button>
                <button onClick={next} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ChevronRight size={20} /></button>
                <div className="px-4 font-bold text-gray-900 min-w-[160px] text-center border-l border-gray-200 ml-2">
                    {getTitle()}
                </div>
             </div>

             {/* View Switcher */}
             <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                {[
                    { id: 'month', icon: Grid3X3, label: 'Month' },
                    { id: 'week', icon: Columns, label: 'Week' },
                    { id: 'day', icon: AlignJustify, label: 'Day' },
                    { id: 'agenda', icon: LayoutList, label: 'List' }
                ].map(v => (
                    <button
                        key={v.id}
                        onClick={() => setViewMode(v.id as ViewMode)}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-all ${viewMode === v.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        title={v.label}
                    >
                        <v.icon size={18} />
                        <span className="hidden xl:inline">{v.label}</span>
                    </button>
                ))}
             </div>

             <button 
                onClick={handleCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm"
             >
                <Plus size={20} /> Add Event
             </button>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      {viewMode === 'month' && <MonthView />}
      {(viewMode === 'week' || viewMode === 'day') && <TimeGridView mode={viewMode} />}
      {viewMode === 'agenda' && <AgendaView />}

      {/* --- CREATE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">New Appointment</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title / Description</label>
                        <input 
                            required 
                            type="text" 
                            className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                            placeholder="e.g. 15,000km Service"
                            value={formData.title || ''}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                            <select 
                                required
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.customerId || ''}
                                onChange={e => setFormData({...formData, customerId: e.target.value})}
                            >
                                <option value="">Select Customer</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                            <select 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.vehicleId || ''}
                                onChange={e => setFormData({...formData, vehicleId: e.target.value})}
                            >
                                <option value="">Select Vehicle</option>
                                {vehicles
                                    .filter(v => !formData.customerId || v.ownerId === formData.customerId)
                                    .map(v => <option key={v.id} value={v.id}>{v.registration}</option>)
                                }
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                            <input 
                                required 
                                type="datetime-local" 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.start?.slice(0,16)}
                                onChange={e => setFormData({...formData, start: new Date(e.target.value).toISOString()})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <input 
                                required 
                                type="datetime-local" 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.end?.slice(0,16)}
                                onChange={e => setFormData({...formData, end: new Date(e.target.value).toISOString()})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value as any})}
                            >
                                <option value="Service">Service</option>
                                <option value="Inspection">Inspection</option>
                                <option value="Repair">Repair</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Schedule</label>
                            <div className="relative">
                                <Repeat className="absolute left-3 top-3 text-gray-400" size={16} />
                                <select 
                                    className="w-full border rounded-lg p-2.5 pl-10 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={formData.recurrence}
                                    onChange={e => setFormData({...formData, recurrence: e.target.value as any})}
                                >
                                    <option value="None">Does not repeat</option>
                                    <option value="Daily">Daily</option>
                                    <option value="Weekly">Weekly</option>
                                    <option value="Monthly">Monthly</option>
                                </select>
                            </div>
                         </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea 
                            className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                            placeholder="Additional details..."
                            value={formData.notes || ''}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2">
                            <Check size={18} /> Schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
