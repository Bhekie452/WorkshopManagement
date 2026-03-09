
import React, { useState } from 'react';
import { store } from '../services/store';
import { FirestoreService } from '../services/firestore';
import { GoogleGenAI } from "@google/genai";
import { Activity, Cpu, Search, BrainCircuit, Terminal, Save, CheckCircle2 } from 'lucide-react';
import { DiagnosticRecord } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const Diagnostics: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'symptoms' | 'dtc' | 'vin' | 'history' | 'battery'>('symptoms');
  const [vehicles] = useState(store.getVehicles());
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  
  // AI Symptom Analysis State
  const [symptoms, setSymptoms] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // DTC Lookup State
  const [dtcCode, setDtcCode] = useState('');
  const [dtcResult, setDtcResult] = useState<{code: string, desc: string, fix: string} | null>(null);

    // History State
    const [history] = useState<DiagnosticRecord[]>(store.getDiagnostics());

    // VIN Decoder State
    const [vin, setVin] = useState('');
    const [vinResult, setVinResult] = useState<any>(null);
    const [vinError, setVinError] = useState('');

    // Battery Analysis State
    const [telemetry, setTelemetry] = useState({
        current_soh: 85,
        cycle_count: 500,
        avg_temperature: 25,
        fast_charge_ratio: 0.2,
        age_months: 24,
        avg_dod: 50,
        capacity_kwh: 75,
        ambient_temp_avg: 22,
    });
    const [batteryHealth, setBatteryHealth] = useState<any>(null);
    const [isPredicting, setIsPredicting] = useState(false);

    // Simple VIN decode logic (for demo; real-world would call an API)
    const handleVinDecode = () => {
        setVinError('');
        setVinResult(null);
        if (!vin || vin.length < 17) {
            setVinError('VIN must be 17 characters.');
            return;
        }
        // Demo decode: extract year, manufacturer, country
        // Real implementation would use a VIN decoding API
        const yearCode = vin[9];
        const yearMap: Record<string, string> = { 'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014', 'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019', 'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024', 'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029', 'Y': '2030', '1': '2001', '2': '2002', '3': '2003', '4': '2004', '5': '2005', '6': '2006', '7': '2007', '8': '2008', '9': '2009' };
        const year = yearMap[yearCode] || 'Unknown';
        const wmi = vin.slice(0, 3);
        const manufacturer = wmi === '1HG' ? 'Honda' : wmi === 'JHM' ? 'Honda (Japan)' : wmi === 'WVW' ? 'Volkswagen' : 'Unknown';
        const country = wmi[0] === '1' ? 'USA' : wmi[0] === 'J' ? 'Japan' : wmi[0] === 'W' ? 'Germany' : 'Unknown';
        setVinResult({ year, manufacturer, country, vin });
    };

  const handleAIAnalysis = async () => {
    if (!symptoms) return;
    setIsAnalyzing(true);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback if no API key in this demo env
        setTimeout(() => {
           setAiAnalysis("**Analysis Result:**\nBased on the symptoms described (Engine sputtering), this is likely a misfire issue.\n\n**Possible Causes:**\n1. Spark Plugs worn out\n2. Ignition Coil failure\n3. Fuel Injector clog\n\n**Recommended Action:** Check ODB-II codes for P030x series.");
           setIsAnalyzing(false);
        }, 1500);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = 'gemini-2.5-flash';
      const prompt = `You are an expert automotive master technician. Analyze these vehicle symptoms and provide a diagnostic assessment, possible causes, and recommended troubleshooting steps. Vehicle: ${vehicles.find(v => v.id === selectedVehicleId)?.make || 'Unknown'} ${vehicles.find(v => v.id === selectedVehicleId)?.model || ''}. Symptoms: ${symptoms}`;
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      
      setAiAnalysis(response.text || 'No analysis returned.');
    } catch (e) {
      console.error(e);
      setAiAnalysis("Error connecting to AI service. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

    const handleDTCSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = dtcCode.toUpperCase();
        // Try Firestore first
        try {
            const dtc = await FirestoreService.getById<any>('dtcCodes', code);
            if (dtc) {
                setDtcResult({ code, desc: dtc.desc, fix: dtc.fix });
                return;
            }
        } catch (err) {
            // Ignore and fallback to mock
        }
        // Fallback to mock DB
        const mockDB: Record<string, any> = {
            'P0300': { desc: 'Random/Multiple Cylinder Misfire Detected', fix: 'Check plugs, coils, vacuum leaks.' },
            'P0420': { desc: 'Catalyst System Efficiency Below Threshold', fix: 'Check O2 sensors, catalytic converter.' },
            'P0171': { desc: 'System Too Lean (Bank 1)', fix: 'Clean MAF sensor, check for vacuum leaks.' }
        };
        const res = mockDB[code] || { desc: 'Code description not found in local DB.', fix: 'Refer to manufacturer manual.' };
        setDtcResult({ code, ...res });
    };

  const saveToHistory = () => {
    if (!selectedVehicleId) return;
    store.addDiagnostic({
        id: '',
        vehicleId: selectedVehicleId,
        date: new Date().toISOString(),
        symptoms: symptoms || `DTC Lookup: ${dtcCode}`,
        dtcCodes: dtcCode ? [dtcCode] : [],
        aiAnalysis: aiAnalysis
    });
    alert("Diagnostic record saved to history.");
  };

  const handleBatteryAnalysis = async () => {
    if (!selectedVehicleId) return;
    setIsPredicting(true);
    try {
        await (store as any).addDiagnosticWithRUL({
            vehicleId: selectedVehicleId,
            date: new Date().toISOString(),
            symptoms: 'Battery Health Check',
            dtcCodes: [],
            aiAnalysis: 'Self-triggered battery health analysis'
        }, telemetry);
        
        const health = await (store as any).getBatteryHealth(selectedVehicleId);
        setBatteryHealth(health);
    } catch (err) {
        console.error(err);
        alert("Failed to run battery analysis. Ensure backend is running.");
    } finally {
        setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Diagnostic Tools</h1>
        <select 
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
        >
            <option value="">Select Vehicle for Context</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration} - {v.make} {v.model}</option>)}
        </select>
      </div>

      {/* Navigation Tabs */}
    <div className="flex border-b border-gray-200 space-x-6">
            <button 
                onClick={() => setActiveTab('symptoms')}
                className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'symptoms' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <span className="flex items-center gap-2"><BrainCircuit size={16} /> AI Symptom Analyzer</span>
            </button>
            <button 
                onClick={() => setActiveTab('dtc')}
                className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'dtc' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                 <span className="flex items-center gap-2"><Terminal size={16} /> DTC Code Lookup</span>
            </button>
            <button 
                onClick={() => setActiveTab('vin')}
                className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'vin' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                 <span className="flex items-center gap-2"><Cpu size={16} /> VIN Decoder</span>
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                 <span className="flex items-center gap-2"><Activity size={16} /> Diagnostic History</span>
            </button>
            <button 
                onClick={() => setActiveTab('battery')}
                className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'battery' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                 <span className="flex items-center gap-2"><Cpu size={16} /> EV Battery AI Analysis</span>
            </button>
                    {/* VIN DECODER TAB */}
                    {activeTab === 'vin' && (
                        <div className="p-6 max-w-xl mx-auto">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">VIN Decoder</h3>
                            <p className="text-sm text-gray-500 mb-4">Enter a 17-character VIN to decode vehicle information.</p>
                            <div className="flex gap-4 mb-4">
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-3 font-mono text-lg uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. 1HGCM82633A123456"
                                    value={vin}
                                    maxLength={17}
                                    onChange={e => setVin(e.target.value.toUpperCase())}
                                />
                                <button
                                    onClick={handleVinDecode}
                                    className="bg-blue-600 text-white px-6 rounded-lg font-medium"
                                >
                                    Decode
                                </button>
                            </div>
                            {vinError && <div className="text-red-600 text-sm mb-2">{vinError}</div>}
                            {vinResult && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mt-2">
                                    <div className="mb-2"><span className="font-bold">VIN:</span> <span className="font-mono">{vinResult.vin}</span></div>
                                    <div className="mb-2"><span className="font-bold">Year:</span> {vinResult.year}</div>
                                    <div className="mb-2"><span className="font-bold">Manufacturer:</span> {vinResult.manufacturer}</div>
                                    <div className="mb-2"><span className="font-bold">Country:</span> {vinResult.country}</div>
                                </div>
                            )}
                        </div>
                    )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        {/* SYMPTOMS TAB */}
        {activeTab === 'symptoms' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">Describe Symptoms</h3>
                    <p className="text-sm text-gray-500">
                        Describe what the customer is experiencing in plain language. 
                        The AI will correlate this with the vehicle model to suggest potential faults.
                    </p>
                    <textarea 
                        className="w-full h-40 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50"
                        placeholder="e.g. Car shakes when idling, check engine light is flashing, smells like rotten eggs..."
                        value={symptoms}
                        onChange={e => setSymptoms(e.target.value)}
                    />
                    <button 
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzing || !symptoms}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isAnalyzing ? (
                            <>Analyzing...</>
                        ) : (
                            <><BrainCircuit size={20} /> Run AI Analysis</>
                        )}
                    </button>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 h-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Cpu size={20} className="text-indigo-500" /> Analysis Results
                    </h3>
                    {aiAnalysis ? (
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                            {aiAnalysis}
                            <div className="mt-6 pt-4 border-t border-slate-200">
                                <button onClick={saveToHistory} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-2">
                                    <Save size={16} /> Save to Vehicle History
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <BrainCircuit size={48} className="mb-4 opacity-20" />
                            <p>Enter symptoms to generate an AI assessment</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* DTC TAB */}
        {activeTab === 'dtc' && (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <h3 className="text-lg font-bold text-gray-900">Diagnostic Trouble Code Lookup</h3>
                    <p className="text-sm text-gray-500">Enter OBD-II codes to get descriptions and potential fixes</p>
                </div>
                {/* OBD-II Integration Placeholder */}
                <div className="flex flex-col items-center mb-8">
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 mb-2"
                    onClick={() => alert('OBD-II scanner integration coming soon!')}
                  >
                    <Terminal size={18} /> Connect OBD-II Scanner
                  </button>
                  <span className="text-xs text-gray-400">(Future: Connect a Bluetooth/WiFi OBD-II scanner to auto-read codes)</span>
                </div>
                <form onSubmit={handleDTCSubmit} className="flex gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg uppercase tracking-wider font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. P0300"
                            value={dtcCode}
                            onChange={e => setDtcCode(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-medium">Lookup</button>
                </form>

                {dtcResult && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                         <div className="flex items-center gap-3 mb-2">
                             <span className="bg-blue-600 text-white font-mono font-bold px-3 py-1 rounded text-lg">{dtcResult.code}</span>
                             <h4 className="font-bold text-gray-900 text-lg">{dtcResult.desc}</h4>
                         </div>
                         <div className="mt-4 pt-4 border-t border-blue-100">
                             <h5 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-1">Recommended Action</h5>
                             <p className="text-blue-900">{dtcResult.fix}</p>
                         </div>
                    </div>
                )}
            </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
            <div className="p-0">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symptoms / Codes</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {history.map(rec => (
                            <tr key={rec.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(rec.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {rec.vehicleId}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="max-w-md truncate">{rec.symptoms}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle2 size={16} /> Saved
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* EV BATTERY ANALYSIS TAB */}
        {activeTab === 'battery' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 font-premium">Battery Telemetry</h3>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold tracking-wider">EV EXCLUSIVE</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Current SOH (%)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.current_soh}
                                onChange={e => setTelemetry({...telemetry, current_soh: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Cycle Count</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.cycle_count}
                                onChange={e => setTelemetry({...telemetry, cycle_count: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Avg Temperature (°C)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.avg_temperature}
                                onChange={e => setTelemetry({...telemetry, avg_temperature: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Fast Charge Ratio (0-1)</label>
                            <input 
                                type="number" step="0.1"
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.fast_charge_ratio}
                                onChange={e => setTelemetry({...telemetry, fast_charge_ratio: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Age (Months)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.age_months}
                                onChange={e => setTelemetry({...telemetry, age_months: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Avg DOD (%)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={telemetry.avg_dod}
                                onChange={e => setTelemetry({...telemetry, avg_dod: parseFloat(e.target.value)})}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleBatteryAnalysis}
                        disabled={isPredicting || !selectedVehicleId}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 mt-4 transition-all shadow-md active:scale-95"
                    >
                        {isPredicting ? (
                            <><Activity className="animate-spin" size={20} /> Calculating Prediction...</>
                        ) : (
                            <><BrainCircuit size={20} /> Run AI Prediction</>
                        )}
                    </button>
                    {!selectedVehicleId && <p className="text-[10px] text-red-500 text-center font-bold uppercase tracking-widest mt-2 animate-pulse">Select a vehicle to begin</p>}
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 h-full overflow-y-auto max-h-[600px] glass-morphism">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-blue-500" /> AI Insights
                    </h3>
                    
                    {batteryHealth?.current ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm transition-transform hover:scale-[1.02]">
                                    <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-wider">Remaining Life</p>
                                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-indigo-600">
                                        {batteryHealth.current.rulMonths} <span className="text-sm font-medium text-slate-400">Months</span>
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm transition-transform hover:scale-[1.02]">
                                    <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-wider">Condition</p>
                                    <p className={`text-xl font-black ${
                                        batteryHealth.current.status === 'Excellent' ? 'text-emerald-600' :
                                        batteryHealth.current.status === 'Good' ? 'text-blue-600' :
                                        batteryHealth.current.status === 'Fair' ? 'text-amber-500' :
                                        'text-rose-600'
                                    }`}>{batteryHealth.current.status}</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200/50 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">SOH History %</p>
                                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">LIVE FEED</span>
                                </div>
                                <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={[...batteryHealth.history].reverse()}>
                                            <XAxis dataKey="createdAt" hide />
                                            <YAxis domain={['auto', 'auto']} hide />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="soh" 
                                                stroke="#4f46e5" 
                                                strokeWidth={3} 
                                                dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                                                activeDot={{ r: 6, fill: '#4f46e5' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-slate-900/5 rounded-xl p-5 border border-slate-200/50">
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Search size={14} className="text-indigo-500" /> Professional Recommendations
                                </h4>
                                <ul className="space-y-3">
                                    {batteryHealth.current.recommendations.map((rec: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-700 flex gap-3 leading-tight font-medium">
                                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" /> 
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16 opacity-50">
                            <Cpu size={64} className="mb-4 stroke-[1px]" />
                            <p className="text-sm font-bold uppercase tracking-widest">Awaiting Data Signature</p>
                            <p className="text-[10px] text-center mt-2 max-w-[200px]">Perform an AI Prediction sweep to generate battery health insights.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
