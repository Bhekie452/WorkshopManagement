
import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { emailService } from '../services/emailService';
import { GoogleGenAI } from '@google/genai';
import { Job, JobStatus, Priority, Customer, Vehicle, Part, JobTask, JobPartUsage, JobLabor, Attachment } from '../types';
import { 
  Plus, Filter, Search, Calendar, ChevronRight, X, BrainCircuit, Users, 
  Settings, PenTool, ClipboardList, MessageCircle, Mail, Smartphone,
  Clock, Package, AlertTriangle, CheckCircle2, History, Send, Gauge,
  Paperclip, Image, FileText, Upload, Loader2, Trash2
} from 'lucide-react';

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inventory, setInventory] = useState<Part[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'parts' | 'communication' | 'history' | 'attachments'>('overview');
  
  // Notification Simulation
  const [notifMessage, setNotifMessage] = useState('');
  const [showNotifToast, setShowNotifToast] = useState(false);
  
  // AI Checklist Generation
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  
  // Parts Search
  const [partSearchQuery, setPartSearchQuery] = useState('');
  
  // Labour Form State
  const [showLabourForm, setShowLabourForm] = useState(false);
  const [labourFormData, setLabourFormData] = useState({
      description: '',
      hours: 1,
      ratePerHour: 500,
      technicianName: 'Current User'
  });
  
  // Sending Notification State
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Job>>({
    priority: Priority.MEDIUM,
    status: JobStatus.PENDING,
    serviceType: '',
    description: '',
    estimatedCost: 0,
    customerId: '',
    vehicleId: '',
    tasks: [],
    partsUsed: [],
    laborLog: [],
    activityLog: [],
    notifications: [],
    attachments: []
  });
  
  // Separate state for mileage input to avoid polluting Job object until vehicle update
  const [currentMileage, setCurrentMileage] = useState<number>(0);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'ALL'>('ALL');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setJobs(store.getJobs());
    setCustomers(store.getCustomers());
    setVehicles(store.getVehicles());
    setInventory(store.getParts());
  };

  const handleCreate = () => {
    setSelectedJob(null);
    setFormData({
        priority: Priority.MEDIUM,
        status: JobStatus.PENDING,
        serviceType: 'General Service',
        description: '',
        estimatedCost: 0,
        customerId: customers[0]?.id || '',
        vehicleId: vehicles[0]?.id || '',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        tasks: [
            { id: '1', description: 'Initial Inspection', completed: false },
            { id: '2', description: 'Safety Check', completed: false }
        ],
        partsUsed: [],
        laborLog: [],
        activityLog: [],
        notifications: [],
        attachments: []
    });
    // Set initial mileage from first vehicle if available
    const v = vehicles[0];
    if(v) setCurrentMileage(v.mileage);

    setActiveTab('overview');
    setIsModalOpen(true);
  };

  const handleEdit = (job: Job) => {
    setSelectedJob(job);
    setFormData({ ...job });
    // Set mileage from vehicle
    const v = vehicles.find(veh => veh.id === job.vehicleId);
    if(v) setCurrentMileage(v.mileage);
    
    setActiveTab('overview');
    setIsModalOpen(true);
  };
  
  const handleVehicleChange = (vehicleId: string) => {
      setFormData({...formData, vehicleId});
      const v = vehicles.find(veh => veh.id === vehicleId);
      if(v) setCurrentMileage(v.mileage);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.customerId || !formData.vehicleId || !formData.description) return;

    // 1. Update Job
    if (selectedJob) {
      store.updateJob({ ...selectedJob, ...formData } as Job);
      store.addJobLog(selectedJob.id, 'Updated', 'Job details updated manually');
    } else {
      store.addJob({
        ...formData,
        createdAt: new Date().toISOString(),
        notes: ''
      } as Job);
    }
    
    // 2. Update Vehicle Mileage History
    if(formData.vehicleId) {
        store.updateVehicleMileage(
            formData.vehicleId, 
            currentMileage, 
            selectedJob ? `Job Update #${selectedJob.id}` : 'New Job Creation'
        );
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Basic size check (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max size is 5MB.");
        return;
      }

      try {
        const base64 = await store.convertFileToBase64(file);
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataUrl: base64,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Current User'
        };

        const updatedAttachments = [newAttachment, ...(formData.attachments || [])];
        setFormData({ ...formData, attachments: updatedAttachments });
        
        // Auto-save if editing existing job
        if (selectedJob) {
          store.addJobAttachment(selectedJob.id, newAttachment);
          store.addJobLog(selectedJob.id, 'File Attached', `Uploaded ${file.name}`);
        }
      } catch (err) {
        console.error("Upload failed", err);
        alert("Failed to upload file.");
      }
    }
  };

  // Labour Handler
  const handleSaveLabour = () => {
    const newLabour: JobLabor = {
      id: Date.now().toString(),
      technicianId: '1',
      technicianName: labourFormData.technicianName,
      description: labourFormData.description,
      hours: labourFormData.hours,
      ratePerHour: labourFormData.ratePerHour,
      totalCost: labourFormData.hours * labourFormData.ratePerHour,
      date: new Date().toISOString()
    };

    const updatedLaborLog = [...(formData.laborLog || []), newLabour];
    setFormData({ ...formData, laborLog: updatedLaborLog });

    // Auto-save if editing existing job
    if (selectedJob) {
      const updatedJob = { ...selectedJob, laborLog: updatedLaborLog };
      store.updateJob(selectedJob.id, { laborLog: updatedLaborLog });
      store.addJobLog(selectedJob.id, 'Labor Added', `${labourFormData.hours} hours logged for ${labourFormData.description}`);
    }

    // Reset form and close modal
    setLabourFormData({
      description: '',
      hours: 1,
      ratePerHour: 500,
      technicianName: 'Current User'
    });
    setShowLabourForm(false);
  };

  // --- SUB-COMPONENT HANDLERS ---

  const toggleTask = (taskId: string) => {
    const updatedTasks = formData.tasks?.map(t => 
       t.id === taskId ? { ...t, completed: !t.completed } : t
    ) || [];
    setFormData({ ...formData, tasks: updatedTasks });
    
    // Auto-save progress if editing existing job
    if(selectedJob) {
        store.updateJob({ ...selectedJob, tasks: updatedTasks });
    }
  };

  const addTask = (desc: string) => {
      if(!desc) return;
      const newTask: JobTask = { id: Date.now().toString(), description: desc, completed: false };
      setFormData({ ...formData, tasks: [...(formData.tasks || []), newTask] });
  };

  const addPartToJob = (partId: string) => {
      const part = inventory.find(p => p.id === partId);
      if(!part) return;

      const newPartUsage: JobPartUsage = {
          id: Date.now().toString(),
          partId: part.id,
          name: part.name,
          quantity: 1,
          unitCost: part.sellingPrice,
          totalCost: part.sellingPrice
      };

      const updatedParts = [...(formData.partsUsed || []), newPartUsage];
      setFormData({ 
          ...formData, 
          partsUsed: updatedParts,
          // Auto update estimated cost
          estimatedCost: (formData.estimatedCost || 0) + part.sellingPrice
      });

      if(selectedJob) {
          store.addJobLog(selectedJob.id, 'Part Added', `Added ${part.name} to job card`);
      }
  };

  const removePartFromJob = (partUsageId: string) => {
      const partToRemove = formData.partsUsed?.find(p => p.id === partUsageId);
      if (!partToRemove) return;
      const updatedParts = (formData.partsUsed || []).filter(p => p.id !== partUsageId);
      const newEstimate = Math.max(0, (formData.estimatedCost || 0) - partToRemove.totalCost);
      setFormData({ ...formData, partsUsed: updatedParts, estimatedCost: newEstimate });
      if (selectedJob) {
          store.updateJob(selectedJob.id, { partsUsed: updatedParts, estimatedCost: newEstimate });
          store.addJobLog(selectedJob.id, 'Part Removed', `Removed ${partToRemove.name} from job card`);
      }
  };

  const removeLabourFromJob = (labourId: string) => {
      const labourToRemove = formData.laborLog?.find(l => l.id === labourId);
      if (!labourToRemove) return;
      const updatedLabor = (formData.laborLog || []).filter(l => l.id !== labourId);
      const newEstimate = Math.max(0, (formData.estimatedCost || 0) - labourToRemove.totalCost);
      setFormData({ ...formData, laborLog: updatedLabor, estimatedCost: newEstimate });
      if (selectedJob) {
          store.updateJob(selectedJob.id, { laborLog: updatedLabor, estimatedCost: newEstimate });
          store.addJobLog(selectedJob.id, 'Labor Removed', `Removed ${labourToRemove.description} from job card`);
      }
  };

  const sendNotification = async (type: 'SMS' | 'WHATSAPP' | 'EMAIL', template: string) => {
    if (!selectedJob) return;
    
    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) {
      alert('Customer not found for this job');
      return;
    }

    const message = template.replace('{{customer}}', customer.name).replace('{{id}}', selectedJob.id);
    const recipient = customer.phone || customer.email;
    
    // Show loading state
    setIsSendingNotif(true);
    
    try {
      if (type === 'EMAIL' && customer.email) {
        // Send actual email via emailService
        const result = await emailService.send({
          to: customer.email,
          subject: `Job #${selectedJob.id} - Update`,
          text: message,
          html: `<p style="font-family: Arial, sans-serif;">${message}</p>`
        });
        
        if (!result.success) {
          console.error('Email failed:', result.error);
        }
      } else if (type === 'SMS' || type === 'WHATSAPP') {
        // SMS/WhatsApp - show info (would need SMS gateway integration)
        console.log(`[${type}] Would send to ${customer.phone}: ${message}`);
        alert(`📱 ${type} would be sent to ${customer.phone}: ${message.substring(0, 50)}...`);
      }
      
      // Log notification to store regardless of delivery status
      store.logNotification(selectedJob.id, type, message, recipient);
      store.addJobLog(selectedJob.id, 'Notification Sent', `Sent ${type} update to customer`);
      
      // Also update mileage on notification if context implies vehicle is at shop
      if (formData.vehicleId) {
        store.updateVehicleMileage(formData.vehicleId, currentMileage, `Customer Notification (${type})`);
      }
      
      setNotifMessage(`✅ Sent ${type} to ${customer.name}`);
      setShowNotifToast(true);
      setTimeout(() => setShowNotifToast(false), 3000);
      
      // Update local view
      const updatedJob = store.getJobs().find(j => j.id === selectedJob.id);
      if (updatedJob) setFormData(updatedJob);
      
    } catch (error) {
      console.error('Failed to send notification:', error);
      alert('Failed to send notification. Check console for details.');
    } finally {
      setIsSendingNotif(false);
    }
  };

  // --- RENDERING HELPERS ---

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PENDING: return 'bg-gray-100 text-gray-800 border-gray-200';
      case JobStatus.IN_PROGRESS: return 'bg-blue-50 text-blue-700 border-blue-200';
      case JobStatus.AWAITING_PARTS: return 'bg-orange-50 text-orange-700 border-orange-200';
      case JobStatus.COMPLETED: return 'bg-green-50 text-green-700 border-green-200';
      case JobStatus.CANCELLED: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.id.toLowerCase().includes(search.toLowerCase()) || 
                          job.serviceType.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || job.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
            <p className="text-sm text-gray-500">Track jobs, manage workflow, and update customers.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={20} /> New Job Card
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-4 border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search Job ID, vehicle, or service type..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter size={20} className="text-gray-400 hidden sm:block" />
          {['ALL', JobStatus.PENDING, JobStatus.IN_PROGRESS, JobStatus.AWAITING_PARTS, JobStatus.COMPLETED].map((status) => (
             <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                    filterStatus === status 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
             >
                {status === 'ALL' ? 'All Jobs' : status}
             </button>
          ))}
        </div>
      </div>

      {/* Job List (Grid View) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredJobs.length > 0 ? (
          filteredJobs.map(job => {
            const customer = customers.find(c => c.id === job.customerId);
            const vehicle = vehicles.find(v => v.id === job.vehicleId);
            const progress = job.tasks && job.tasks.length > 0 
                ? Math.round((job.tasks.filter(t => t.completed).length / job.tasks.length) * 100) 
                : 0;

            return (
              <div 
                key={job.id} 
                onClick={() => handleEdit(job)}
                className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{job.id}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getStatusColor(job.status)}`}>
                            {job.status}
                        </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{job.serviceType}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">{job.description}</p>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                        <div className="bg-blue-50 p-1.5 rounded text-blue-600"><Users size={16} /></div>
                        <span className="font-medium truncate">{customer?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                         <div className="bg-purple-50 p-1.5 rounded text-purple-600"><Settings size={16} /></div>
                         <span>{vehicle?.make} {vehicle?.model} ({vehicle?.registration})</span>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-bold text-blue-600">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="mt-4 flex justify-between items-end">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={12} /> Due {new Date(job.dueDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-3">
                            {job.attachments && job.attachments.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    <Paperclip size={10} /> {job.attachments.length}
                                </span>
                            )}
                            <span className="font-bold text-gray-900 text-lg">R{job.estimatedCost.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No jobs found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* --- NOTIFICATION TOAST --- */}
      {showNotifToast && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-[60] animate-bounce-in">
              <CheckCircle2 className="text-green-400" size={20} />
              <span className="font-medium">{notifMessage}</span>
          </div>
      )}

      {/* --- FULL JOB CONSOLE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    {selectedJob ? `Job Card: ${selectedJob.id}` : 'New Job Card'}
                    {selectedJob && <span className={`text-sm px-3 py-1 rounded-full border ${getStatusColor(formData.status as JobStatus)}`}>{formData.status}</span>}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedJob ? 'Manage workflow, parts, and customer updates.' : 'Create a new service request.'}</p>
              </div>
              <div className="flex items-center gap-3">
                  {selectedJob && (
                    <>
                      <button 
                        onClick={() => {
                          if (confirm(`Delete job "${selectedJob.id}"? This cannot be undone.`)) {
                            store.deleteJob(selectedJob.id);
                            setIsModalOpen(false);
                            refreshData();
                          }
                        }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Delete Job"
                      >
                          <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleSave()} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                      >
                          <Send size={16} /> Save Changes
                      </button>
                    </>
                  )}
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="border-b border-gray-200 px-6 bg-gray-50 flex gap-6 shrink-0 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Overview', icon: ClipboardList },
                    { id: 'workflow', label: 'Workflow & Tasks', icon: CheckCircle2 },
                    { id: 'parts', label: 'Parts & Labor', icon: Package },
                    { id: 'attachments', label: 'Files & Media', icon: Paperclip },
                    { id: 'communication', label: 'Communication', icon: MessageCircle },
                    { id: 'history', label: 'Audit Log', icon: History },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'border-blue-600 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              
              {/* === TAB: OVERVIEW === */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                             <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings size={18} /> Job Details</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                                    <input 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={formData.serviceType}
                                        onChange={e => setFormData({...formData, serviceType: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as JobStatus})}
                                    >
                                        {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description / Customer Request</label>
                                    <textarea 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex gap-3">
                                        <BrainCircuit className="text-indigo-600 shrink-0 mt-1" size={20} />
                                        <div>
                                            <h4 className="text-sm font-bold text-indigo-900">AI Technician Assistant</h4>
                                            <p className="text-xs text-indigo-700 mt-1 mb-2">
                                                Use Gemini to generate a checklist based on the service description "{formData.serviceType}".
                                            </p>
                                            <button 
                                                type="button" 
                                                disabled={isGeneratingChecklist}
                                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                onClick={async () => {
                                                    setIsGeneratingChecklist(true);
                                                    try {
                                                        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                                                        const vehicle = vehicles.find(v => v.id === formData.vehicleId);
                                                        const vehicleInfo = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.fuelType}, ${vehicle.mileage}km)` : 'Unknown vehicle';

                                                        if (!apiKey) {
                                                            // Fallback: generate context-aware mock tasks based on service type
                                                            const fallbackTasks: Record<string, string[]> = {
                                                                'Regular Service': ['Change engine oil and filter', 'Check and top up all fluids', 'Inspect brake pads and rotors', 'Check tire pressure and tread depth', 'Inspect belts and hoses', 'Test battery condition', 'Check all lights and wipers'],
                                                                'Diagnostics': ['Connect OBD-II scanner and read codes', 'Perform live data analysis', 'Check for pending and stored DTCs', 'Inspect wiring and connectors', 'Test sensor readings against specs', 'Clear codes and road test'],
                                                                'Tire Rotation': ['Remove all wheels', 'Inspect tire tread depth', 'Rotate tires per pattern', 'Check for uneven wear', 'Torque lug nuts to spec', 'Set tire pressures'],
                                                                'Brake Service': ['Inspect brake pads thickness', 'Check brake fluid level and condition', 'Inspect rotors for wear/scoring', 'Check brake lines for leaks', 'Test parking brake', 'Road test brakes'],
                                                                'Software Update': ['Back up current ECU data', 'Connect diagnostic tool', 'Download latest firmware', 'Flash ECU/TCU modules', 'Verify update installation', 'Clear adaptation values', 'Road test and verify'],
                                                            };
                                                            const serviceKey = Object.keys(fallbackTasks).find(k => 
                                                                formData.serviceType?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(formData.serviceType?.toLowerCase() || '')
                                                            );
                                                            const taskList = fallbackTasks[serviceKey || 'Regular Service'] || fallbackTasks['Regular Service'];
                                                            setFormData({
                                                                ...formData,
                                                                tasks: taskList.map((desc, i) => ({
                                                                    id: (Date.now() + i).toString(),
                                                                    description: desc,
                                                                    completed: false
                                                                }))
                                                            });
                                                            setActiveTab('workflow');
                                                            setIsGeneratingChecklist(false);
                                                            return;
                                                        }

                                                        const ai = new GoogleGenAI({ apiKey });
                                                        const prompt = `You are an expert automotive master technician. Generate a detailed step-by-step task checklist for this job:

Service Type: ${formData.serviceType || 'General Service'}
Description: ${formData.description || 'No description provided'}
Vehicle: ${vehicleInfo}

Return ONLY a JSON array of strings, each being a clear, actionable task step. Example format:
["Step 1 description", "Step 2 description"]

Generate 5-10 relevant tasks. No markdown, no explanation, just the JSON array.`;

                                                        const response = await ai.models.generateContent({
                                                            model: 'gemini-2.0-flash',
                                                            contents: prompt,
                                                        });

                                                        const text = (response.text || '').trim();
                                                        console.log('[AI Checklist] Raw response:', text);
                                                        
                                                        // Extract JSON array — handle ```json ... ``` wrapping
                                                        let jsonStr = text;
                                                        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
                                                        if (codeBlockMatch) {
                                                            jsonStr = codeBlockMatch[1].trim();
                                                        }
                                                        // Find the array in the string
                                                        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                                                        const tasks: string[] = arrayMatch ? JSON.parse(arrayMatch[0]) : [];

                                                        if (tasks.length > 0) {
                                                            setFormData({
                                                                ...formData,
                                                                tasks: tasks.map((desc, i) => ({
                                                                    id: (Date.now() + i).toString(),
                                                                    description: String(desc),
                                                                    completed: false
                                                                }))
                                                            });
                                                            // Auto-switch to Workflow tab so user can see the generated tasks
                                                            setActiveTab('workflow');
                                                        } else {
                                                            alert('AI returned no tasks. Try a more detailed description.');
                                                        }
                                                    } catch (err) {
                                                        console.error('AI checklist generation failed:', err);
                                                        alert('Failed to generate checklist. Check your Gemini API key.');
                                                    } finally {
                                                        setIsGeneratingChecklist(false);
                                                    }
                                                }}
                                            >
                                                {isGeneratingChecklist ? (
                                                    <><Loader2 size={14} className="animate-spin" /> Generating...</>
                                                ) : (
                                                    'Generate Smart Checklist'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                             </div>
                         </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                             <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Users size={18} /> Customer</h3>
                             <div className="space-y-3">
                                <select 
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.customerId}
                                    onChange={e => setFormData({...formData, customerId: e.target.value})}
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {formData.customerId && (
                                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-1 border border-gray-100">
                                        {(() => {
                                            const c = customers.find(cust => cust.id === formData.customerId);
                                            return c ? (
                                                <>
                                                    <p className="flex items-center gap-2"><Mail size={14}/> {c.email}</p>
                                                    <p className="flex items-center gap-2"><Smartphone size={14}/> {c.phone}</p>
                                                    <p className="text-xs text-gray-400 mt-2">{c.address}</p>
                                                </>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                             </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                             <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings size={18} /> Vehicle</h3>
                             <div className="space-y-3">
                                <select 
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.vehicleId}
                                    onChange={e => handleVehicleChange(e.target.value)}
                                >
                                    <option value="">Select Vehicle</option>
                                    {vehicles
                                        .filter(v => !formData.customerId || v.ownerId === formData.customerId)
                                        .map(v => <option key={v.id} value={v.id}>{v.make} {v.model} - {v.registration}</option>)
                                    }
                                </select>
                                {formData.vehicleId && (
                                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2 border border-gray-100">
                                        {(() => {
                                            const v = vehicles.find(veh => veh.id === formData.vehicleId);
                                            return v ? (
                                                <>
                                                    <div className="flex justify-between font-bold text-gray-900">
                                                        <span>{v.year} {v.make} {v.model}</span>
                                                        <span className="bg-gray-200 px-1.5 rounded text-xs py-0.5">{v.fuelType}</span>
                                                    </div>
                                                    <p>VIN: {v.vin}</p>
                                                    <div className="border-t border-gray-200 pt-2 mt-1">
                                                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                                                            <Gauge size={12} /> Current Mileage
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold text-gray-900" 
                                                                value={currentMileage}
                                                                onChange={(e) => setCurrentMileage(Number(e.target.value))}
                                                            />
                                                            <span className="text-xs self-center text-gray-500">km</span>
                                                        </div>
                                                        <p className="text-[10px] text-blue-600 mt-1">Updates to mileage will be logged.</p>
                                                    </div>
                                                </>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                             </div>
                        </div>
                        
                        {!selectedJob && (
                             <button onClick={() => handleSave()} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md transition-all">
                                 Create Job Card
                             </button>
                        )}
                    </div>
                </div>
              )}

              {/* === TAB: WORKFLOW === */}
              {activeTab === 'workflow' && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="font-bold text-gray-900 text-lg">Task Checklist</h3>
                              <p className="text-sm text-gray-500">Track progress of specific service items.</p>
                          </div>
                          <div className="text-right">
                               <p className="text-sm font-bold text-blue-600">
                                   {formData.tasks?.filter(t => t.completed).length}/{formData.tasks?.length} Completed
                               </p>
                          </div>
                      </div>

                      <div className="space-y-2 mb-6">
                          {formData.tasks?.map((task, idx) => (
                              <div key={task.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors group">
                                  <input 
                                    type="checkbox" 
                                    checked={task.completed} 
                                    onChange={() => toggleTask(task.id)}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mr-4 cursor-pointer"
                                  />
                                  <span className={`flex-1 font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                      {task.description}
                                  </span>
                                  <button 
                                    onClick={() => {
                                        const newTasks = formData.tasks?.filter(t => t.id !== task.id);
                                        setFormData({...formData, tasks: newTasks});
                                    }}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <X size={18} />
                                  </button>
                              </div>
                          ))}
                          {(!formData.tasks || formData.tasks.length === 0) && (
                              <div className="text-center py-12 text-gray-400 border border-dashed rounded-lg bg-gray-50">
                                  No tasks defined yet. Add one below.
                              </div>
                          )}
                      </div>

                      <div className="flex gap-2">
                          <input 
                            id="newTaskInput"
                            type="text" 
                            placeholder="Add a new task..." 
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            onKeyDown={(e) => {
                                if(e.key === 'Enter') {
                                    addTask(e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                          />
                          <button 
                            onClick={() => {
                                const input = document.getElementById('newTaskInput') as HTMLInputElement;
                                addTask(input.value);
                                input.value = '';
                            }}
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                          >
                              Add
                          </button>
                      </div>
                  </div>
              )}

              {/* === TAB: PARTS & LABOR === */}
              {activeTab === 'parts' && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 space-y-6">
                              {/* Parts Table */}
                              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                  <div className="flex justify-between items-center mb-4">
                                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><Package size={18} /> Parts Used</h3>
                                      <select 
                                        className="text-sm border border-gray-300 rounded-lg p-2 bg-white max-w-[200px]"
                                        onChange={(e) => {
                                            if(e.target.value) {
                                                addPartToJob(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                      >
                                          <option value="">+ Add Part from Inventory</option>
                                          {inventory.map(p => (
                                              <option key={p.id} value={p.id}>{p.name} - R{p.sellingPrice}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-gray-50 text-gray-500">
                                          <tr>
                                              <th className="p-3 rounded-l-lg">Item</th>
                                              <th className="p-3">Qty</th>
                                              <th className="p-3">Unit</th>
                                              <th className="p-3 text-right">Total</th>
                                              <th className="p-3 rounded-r-lg w-10"></th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {formData.partsUsed?.map(p => (
                                              <tr key={p.id} className="border-b border-gray-50 group">
                                                  <td className="p-3 font-medium">{p.name}</td>
                                                  <td className="p-3">{p.quantity}</td>
                                                  <td className="p-3">R{p.unitCost}</td>
                                                  <td className="p-3 text-right">R{p.totalCost}</td>
                                                  <td className="p-3 text-center">
                                                      <button
                                                          onClick={() => removePartFromJob(p.id)}
                                                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                          title="Remove part"
                                                      >
                                                          <Trash2 size={15} />
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                      <tfoot>
                                          <tr>
                                              <td colSpan={4} className="p-3 text-right font-bold text-gray-900">Total Parts:</td>
                                              <td className="p-3 text-right font-bold text-blue-600">
                                                  R{(formData.partsUsed?.reduce((a, b) => a + b.totalCost, 0) || 0).toLocaleString()}
                                              </td>
                                          </tr>
                                      </tfoot>
                                  </table>
                              </div>
                              
                              {/* Labor Table */}
                              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                  <div className="flex justify-between items-center mb-4">
                                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><Clock size={18} /> Labor</h3>
                                      <button onClick={() => setShowLabourForm(true)} className="text-sm text-blue-600 font-medium hover:underline">+ Log Hours</button>
                                  </div>
                                  
                                  {/* Labour List */}
                                  {formData.laborLog && formData.laborLog.length > 0 ? (
                                      <div className="space-y-3">
                                          {formData.laborLog.map((labour) => (
                                              <div key={labour.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                                                  <div>
                                                      <p className="font-medium text-gray-900">{labour.description}</p>
                                                      <p className="text-sm text-gray-500">{labour.technicianName} • {labour.hours}h @ R{labour.ratePerHour}/hr</p>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                      <div className="text-right">
                                                          <p className="font-bold text-gray-900">R{labour.totalCost.toLocaleString()}</p>
                                                          <p className="text-xs text-gray-500">{new Date(labour.date).toLocaleDateString()}</p>
                                                      </div>
                                                      <button
                                                          onClick={() => removeLabourFromJob(labour.id)}
                                                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                          title="Remove labour entry"
                                                      >
                                                          <Trash2 size={15} />
                                                      </button>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <p className="text-gray-400 text-sm italic py-4 text-center">No labor hours logged yet.</p>
                                  )}
                              </div>
                          </div>

                          <div className="space-y-6">
                              <div className="bg-blue-900 text-white p-6 rounded-xl shadow-lg">
                                  <p className="text-blue-200 text-sm mb-1">Total Estimated Cost</p>
                                  <h2 className="text-4xl font-bold">R{formData.estimatedCost?.toLocaleString()}</h2>
                                  <div className="mt-4 pt-4 border-t border-blue-800 text-sm space-y-2">
                                      <div className="flex justify-between">
                                          <span>Parts Total</span>
                                          <span>R{(formData.partsUsed?.reduce((a, b) => a + b.totalCost, 0) || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span>Labor Total</span>
                                          <span>R{(formData.laborLog?.reduce((a, b) => a + b.totalCost, 0) || 0).toLocaleString()}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* === TAB: ATTACHMENTS === */}
              {activeTab === 'attachments' && (
                <div className="space-y-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Paperclip size={18} /> Files & Media
                      </h3>
                      
                      {/* Upload Area */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors mb-6 relative">
                        <input 
                          type="file" 
                          multiple 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleFileUpload}
                          accept="image/*,.pdf,.doc,.docx"
                        />
                        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">Images, PDF, or Docs (Max 5MB)</p>
                      </div>

                      {/* Gallery */}
                      {formData.attachments && formData.attachments.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {formData.attachments.map((file) => (
                            <div key={file.id} className="group relative border rounded-lg p-2 hover:shadow-md transition-all bg-white">
                               {file.fileType.startsWith('image/') ? (
                                 <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                                   <img src={file.dataUrl} alt={file.fileName} className="w-full h-full object-cover" />
                                 </div>
                               ) : (
                                 <div className="aspect-square bg-blue-50 rounded mb-2 flex items-center justify-center text-blue-500">
                                   <FileText size={32} />
                                 </div>
                               )}
                               <p className="text-xs font-medium truncate" title={file.fileName}>{file.fileName}</p>
                               <p className="text-[10px] text-gray-500">{(file.fileSize / 1024).toFixed(1)} KB</p>
                               <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="bg-white rounded-full p-1 shadow hover:text-red-600">
                                    <X size={12} />
                                  </button>
                               </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-400 italic py-4">No files attached yet.</p>
                      )}
                   </div>
                </div>
              )}

              {/* === TAB: COMMUNICATION === */}
              {activeTab === 'communication' && (() => {
                  const commCustomer = customers.find(c => c.id === formData.customerId);
                  const pref = commCustomer?.preferredContact || 'both';
                  const prefLabel = pref === 'email' ? 'Email' : pref === 'phone' ? 'Phone / SMS' : 'Email & Phone';
                  const wantsEmail = pref === 'email' || pref === 'both';
                  const wantsPhone = pref === 'phone' || pref === 'both';

                  // Helper: send to all preferred channels for a given template
                  const sendPreferred = async (template: string) => {
                      if (wantsEmail) {
                          await sendNotification('EMAIL', template);
                      }
                      if (wantsPhone) {
                          await sendNotification('SMS', template);
                      }
                  };

                  return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                      <div className="space-y-6">
                          <h3 className="font-bold text-gray-900 text-lg">Customer Notifications</h3>
                          <p className="text-gray-500 text-sm">Send predefined updates to the customer via their preferred channel.</p>

                          {/* Preferred channel badge */}
                          {commCustomer && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                  <span className="text-sm font-medium text-indigo-700">Preferred channel:</span>
                                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-900">
                                      {wantsEmail && <Mail size={14} />}
                                      {wantsPhone && <Smartphone size={14} />}
                                      {prefLabel}
                                  </span>
                              </div>
                          )}
                          
                          <div className="grid grid-cols-1 gap-4">
                              <button 
                                disabled={isSendingNotif}
                                onClick={() => sendPreferred('Hi {{customer}}, your vehicle check-in is complete. Job #{{id}} has started.')}
                                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group disabled:opacity-50"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-200"><MessageCircle size={24} /></div>
                                      <div className="text-left">
                                          <p className="font-bold text-gray-900">Job Started</p>
                                          <p className="text-xs text-gray-500">
                                              {wantsEmail && wantsPhone ? 'Send Email & SMS' : wantsEmail ? 'Send Email' : 'Send SMS'}
                                          </p>
                                      </div>
                                  </div>
                                  <ChevronRight className="text-gray-300 group-hover:text-green-600" />
                              </button>

                              <button 
                                disabled={isSendingNotif}
                                onClick={() => sendPreferred('Hi {{customer}}, we are waiting for parts for Job #{{id}}. We will update you shortly.')}
                                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all group disabled:opacity-50"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-200"><AlertTriangle size={24} /></div>
                                      <div className="text-left">
                                          <p className="font-bold text-gray-900">Awaiting Parts</p>
                                          <p className="text-xs text-gray-500">
                                              {wantsEmail && wantsPhone ? 'Send Email & SMS' : wantsEmail ? 'Send Email' : 'Send SMS'}
                                          </p>
                                      </div>
                                  </div>
                                  <ChevronRight className="text-gray-300 group-hover:text-orange-600" />
                              </button>

                              <button 
                                disabled={isSendingNotif}
                                onClick={() => sendPreferred('Hi {{customer}}, Job #{{id}} is complete! Your vehicle is ready for collection. Total: R' + formData.estimatedCost)}
                                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-200"><CheckCircle2 size={24} /></div>
                                      <div className="text-left">
                                          <p className="font-bold text-gray-900">Ready for Collection</p>
                                          <p className="text-xs text-gray-500">
                                              {wantsEmail && wantsPhone ? 'Send Email & SMS' : wantsEmail ? 'Send Email' : 'Send SMS'}
                                          </p>
                                      </div>
                                  </div>
                                  <ChevronRight className="text-gray-300 group-hover:text-blue-600" />
                              </button>
                          </div>
                      </div>

                      <div className="bg-gray-100 rounded-xl p-6 border border-gray-200 overflow-y-auto max-h-[500px]">
                          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-4">Notification Log</h3>
                          <div className="space-y-4">
                              {selectedJob?.notifications && selectedJob.notifications.length > 0 ? (
                                  selectedJob.notifications.map(n => (
                                      <div key={n.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                          <div className="flex justify-between items-start mb-1">
                                              <span className="text-xs font-bold text-gray-900">{n.type}</span>
                                              <span className="text-xs text-gray-400">{new Date(n.date).toLocaleString()}</span>
                                          </div>
                                          <p className="text-sm text-gray-600">{n.message}</p>
                                          <p className="text-xs text-gray-400 mt-2">Sent to: {n.sentTo}</p>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-center text-gray-400 text-sm mt-10">No notifications sent yet.</p>
                              )}
                          </div>
                      </div>
                  </div>
                  );
              })()}

              {/* === TAB: HISTORY (LOGS) === */}
              {activeTab === 'history' && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-6">Audit Trail</h3>
                      <div className="relative border-l-2 border-gray-200 ml-3 space-y-8">
                          {selectedJob?.activityLog && selectedJob.activityLog.length > 0 ? (
                              selectedJob.activityLog.map((log, idx) => (
                                  <div key={log.id} className="relative pl-8">
                                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-200 border-2 border-white"></div>
                                      <div>
                                          <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                          <h4 className="text-sm font-bold text-gray-900">{log.action}</h4>
                                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                                          <p className="text-xs text-gray-400 mt-1">User: {log.user}</p>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <p className="pl-8 text-gray-400 italic">No activity recorded.</p>
                          )}
                      </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Labour Form Modal */}
      {showLabourForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Log Labour Hours</h2>
              <button onClick={() => setShowLabourForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={labourFormData.description}
                  onChange={(e) => setLabourFormData({...labourFormData, description: e.target.value})}
                  placeholder="e.g., Oil change, Brake inspection"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={labourFormData.hours}
                    onChange={(e) => setLabourFormData({...labourFormData, hours: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate (R/hr)</label>
                  <input
                    type="number"
                    value={labourFormData.ratePerHour}
                    onChange={(e) => setLabourFormData({...labourFormData, ratePerHour: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
                <input
                  type="text"
                  value={labourFormData.technicianName}
                  onChange={(e) => setLabourFormData({...labourFormData, technicianName: e.target.value})}
                  placeholder="Technician name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="text-xl font-bold text-gray-900">
                    R{(labourFormData.hours * labourFormData.ratePerHour).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowLabourForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLabour}
                disabled={!labourFormData.description}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Labour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
