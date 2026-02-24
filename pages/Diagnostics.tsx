
import React, { useState } from 'react';
import { store } from '../services/store';
import { GoogleGenAI } from "@google/genai";
import { Activity, Cpu, Search, BrainCircuit, Terminal, Save, CheckCircle2 } from 'lucide-react';
import { DiagnosticRecord } from '../types';

export const Diagnostics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'symptoms' | 'dtc' | 'history'>('symptoms');
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

  const handleDTCSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock DB
    const mockDB: Record<string, any> = {
        'P0300': { desc: 'Random/Multiple Cylinder Misfire Detected', fix: 'Check plugs, coils, vacuum leaks.' },
        'P0420': { desc: 'Catalyst System Efficiency Below Threshold', fix: 'Check O2 sensors, catalytic converter.' },
        'P0171': { desc: 'System Too Lean (Bank 1)', fix: 'Clean MAF sensor, check for vacuum leaks.' }
    };
    const code = dtcCode.toUpperCase();
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
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-2 font-medium text-sm transition-colors ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
         >
             <span className="flex items-center gap-2"><Activity size={16} /> Diagnostic History</span>
         </button>
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
      </div>
    </div>
  );
};
