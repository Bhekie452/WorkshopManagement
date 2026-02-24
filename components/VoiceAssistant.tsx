
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const VoiceAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const navigate = useNavigate();

  // Simple simulated voice command processing
  const processCommand = (cmd: string) => {
    const lowerCmd = cmd.toLowerCase();
    
    if (lowerCmd.includes('dashboard') || lowerCmd.includes('home')) {
      navigate('/');
      return 'Navigating to Dashboard.';
    }
    if (lowerCmd.includes('jobs') || lowerCmd.includes('job card')) {
      navigate('/jobs');
      return 'Opening Job Management.';
    }
    if (lowerCmd.includes('inventory') || lowerCmd.includes('parts')) {
      navigate('/inventory');
      return 'Opening Inventory.';
    }
    if (lowerCmd.includes('calendar') || lowerCmd.includes('schedule')) {
      navigate('/schedule');
      return 'Opening Calendar.';
    }
    if (lowerCmd.includes('invoices') || lowerCmd.includes('billing')) {
      navigate('/invoices');
      return 'Opening Invoices.';
    }
    if (lowerCmd.includes('customer')) {
      navigate('/customers');
      return 'Opening Customer Database.';
    }
    
    return "I didn't quite catch that. Try saying 'Go to Jobs' or 'Open Inventory'.";
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    setIsListening(true);
    setTranscript('');
    setResponse('');
    
    // Simulate recognition delay
    // In a real app, this would use window.SpeechRecognition
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        const reply = processCommand(text);
        setResponse(reply);
        speak(reply);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setResponse('Error accessing microphone.');
      };

      recognition.start();
    } else {
      // Fallback for browsers without API support (Simulation)
      setTimeout(() => {
        const simulatedText = "Go to Jobs";
        setTranscript(simulatedText);
        const reply = processCommand(simulatedText);
        setResponse(reply);
        setIsListening(false);
      }, 2000);
    }
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all z-50 flex items-center justify-center group"
      >
        <Mic size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2">
          Voice Assist
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col">
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Command size={18} />
          <span className="font-bold">AutoFlow Voice</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-blue-500 p-1 rounded">
          <X size={18} />
        </button>
      </div>
      
      <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
        {isListening ? (
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
              <Mic size={32} />
            </div>
            <p className="text-gray-500 font-medium">Listening...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <button 
              onClick={startListening}
              className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 hover:bg-blue-200 transition-colors"
            >
              <Mic size={32} />
            </button>
            <p className="text-gray-400 text-sm mb-4">Tap to speak</p>
          </div>
        )}

        {transcript && (
          <div className="w-full bg-gray-50 p-3 rounded-lg mb-2">
            <p className="text-xs text-gray-500 uppercase font-bold mb-1">You said</p>
            <p className="text-gray-800 italic">"{transcript}"</p>
          </div>
        )}
        
        {response && (
          <div className="w-full bg-blue-50 p-3 rounded-lg">
             <p className="text-xs text-blue-500 uppercase font-bold mb-1">Response</p>
             <p className="text-blue-900">{response}</p>
          </div>
        )}
      </div>
    </div>
  );
};
