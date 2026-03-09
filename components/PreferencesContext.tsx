import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '../types';
import { store } from '../services/store';

const DEFAULT_PREFS: UserPreferences = {
  defaultView: 'list',
  dateFormat: 'medium',
  currency: 'ZAR',
  currencySymbol: 'R',
  columnVisibility: {},
  emailFrequency: 'instant',
};

const STORAGE_KEY = 'user_preferences';

function loadPrefs(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  formatDate: (date: string | Date) => string;
  formatCurrency: (amount: number) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPrefs);

  useEffect(() => {
    savePrefs(preferences);
  }, [preferences]);

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences((p) => {
      const next = { ...p, ...updates };
      return next;
    });
  }, []);

  const formatDate = useCallback(
    (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const fmt = preferences.dateFormat;
      if (fmt === 'short') return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' });
      if (fmt === 'long') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (fmt === 'iso') return d.toISOString().split('T')[0];
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    },
    [preferences.dateFormat]
  );

  const formatCurrency = useCallback(
    (amount: number) => {
      const sym = preferences.currencySymbol;
      return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [preferences.currencySymbol]
  );

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, formatDate, formatCurrency }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) return ctx;
  return ctx;
};
