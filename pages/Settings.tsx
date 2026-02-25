import React, { useState, useEffect } from 'react';
import { 
  Building2, Save, RotateCcw, MapPin, Phone, Mail, Globe, 
  Clock, DollarSign, FileText, CreditCard, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { companyProfile } from '../services/companyProfile';
import { emailService } from '../services/emailService';
import { CompanyProfile } from '../types';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const Settings: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'company' | 'banking' | 'hours' | 'invoice'>('company');
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Wait for Firebase to restore auth state before loading profile
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      if (user) {
        setIsAuthed(true);
        setAuthChecked(true);
        if (!user.uid) {
          setUserUid(null);
          setIsAuthed(false);
          return;
        }
        setUserUid(user.uid);
        try {
          const p = await companyProfile.getProfile(user.uid);
          if (mounted) setProfile(p);
        } catch (e) {
          console.error('Failed to load company profile', e);
        }
      } else {
        setIsAuthed(false);
        setUserUid(null);
        setAuthChecked(true);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    try {
      await companyProfile.saveProfile(profile, userUid ?? undefined);
      // Keep email service in sync with latest profile
      emailService.setCompanyInfo({
        name: profile.name,
        email: profile.contact.email,
        phone: profile.contact.phone,
        address: `${profile.address.street}, ${profile.address.city}`,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  };

  const handleReset = () => setShowResetModal(true);
  const confirmReset = async () => {
    try {
      const defaultProfile = await companyProfile.resetProfile(userUid ?? undefined);
      setProfile(defaultProfile);
      setSaved(true);
      setShowResetModal(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to reset profile', e);
    }
  };

  const updateField = (field: string, value: any) => {
    setProfile(prev => prev ? ({ ...prev, [field]: value }) : prev);
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    setProfile(prev => {
      if (!prev) return prev;
      // @ts-ignore - dynamic parent
      return {
        ...prev,
        [parent]: { ...prev[parent as keyof CompanyProfile], [field]: value }
      } as CompanyProfile;
    });
  };

  const updateHours = (day: string, field: string, value: any) => {
    setProfile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        operatingHours: {
          ...prev.operatingHours,
          [day]: { ...prev.operatingHours[day as keyof typeof prev.operatingHours], [field]: value }
        }
      } as CompanyProfile;
    });
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  if (!authChecked) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Checking authentication…</div>
      </div>
    );
  }
  if (!isAuthed) {
    return (
      <div className="p-6">
        <div className="text-red-600">You must be signed in to view or edit company profile settings.</div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your workshop details</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              <CheckCircle2 size={20} />
              <span>Saved successfully!</span>
            </div>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RotateCcw size={18} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 font-medium rounded-t-lg ${
            activeTab === 'company' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 size={18} className="inline mr-2" />
          Company
        </button>
        <button
          onClick={() => setActiveTab('banking')}
          className={`px-4 py-2 font-medium rounded-t-lg ${
            activeTab === 'banking' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CreditCard size={18} className="inline mr-2" />
          Banking
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`px-4 py-2 font-medium rounded-t-lg ${
            activeTab === 'hours' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock size={18} className="inline mr-2" />
          Hours
        </button>
        <button
          onClick={() => setActiveTab('invoice')}
          className={`px-4 py-2 font-medium rounded-t-lg ${
            activeTab === 'invoice' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={18} className="inline mr-2" />
          Invoice
        </button>
      </div>

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <h2 className="text-lg font-semibold">Company Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={profile.tagline || ''}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Professional Auto Services"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  value={profile.registrationNumber || ''}
                  onChange={(e) => updateField('registrationNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2024/123456/07"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Number
                </label>
                <input
                  type="text"
                  value={profile.vatNumber || ''}
                  onChange={(e) => updateField('vatNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="4120185467"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <MapPin size={18} />
                Address
              </h3>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Street</label>
                <input
                  type="text"
                  value={profile.address.street}
                  onChange={(e) => updateNestedField('address', 'street', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">City</label>
                  <input
                    type="text"
                    value={profile.address.city}
                    onChange={(e) => updateNestedField('address', 'city', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Province</label>
                  <input
                    type="text"
                    value={profile.address.province}
                    onChange={(e) => updateNestedField('address', 'province', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={profile.address.postalCode}
                    onChange={(e) => updateNestedField('address', 'postalCode', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Country</label>
                  <input
                    type="text"
                    value={profile.address.country}
                    onChange={(e) => updateNestedField('address', 'country', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t pt-6 mt-6">
            <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
              <Phone size={18} />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={profile.contact.phone}
                  onChange={(e) => updateNestedField('contact', 'phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Alt Phone</label>
                <input
                  type="tel"
                  value={profile.contact.alternativePhone || ''}
                  onChange={(e) => updateNestedField('contact', 'alternativePhone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.contact.email}
                  onChange={(e) => updateNestedField('contact', 'email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Website</label>
                <input
                  type="url"
                  value={profile.contact.website || ''}
                  onChange={(e) => updateNestedField('contact', 'website', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://yourwebsite.co.za"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banking Tab */}
      {activeTab === 'banking' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <CreditCard className="text-green-600" size={24} />
            </div>
            <h2 className="text-lg font-semibold">Banking Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={profile.banking.bankName}
                onChange={(e) => updateNestedField('banking', 'bankName', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <select
                value={profile.banking.accountType}
                onChange={(e) => updateNestedField('banking', 'accountType', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Business Current">Business Current</option>
                <option value="Savings">Savings</option>
                <option value="Transmission">Transmission</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={profile.banking.accountName}
                onChange={(e) => updateNestedField('banking', 'accountName', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={profile.banking.accountNumber}
                onChange={(e) => updateNestedField('banking', 'accountNumber', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch Code
              </label>
              <input
                type="text"
                value={profile.banking.branchCode}
                onChange={(e) => updateNestedField('banking', 'branchCode', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Banking details appear on:</p>
              <ul className="list-disc list-inside mt-1">
                <li>All invoices and quotes</li>
                <li>Email communications</li>
                <li>Payment requests</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Hours Tab */}
      {activeTab === 'hours' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Clock className="text-purple-600" size={24} />
            </div>
            <h2 className="text-lg font-semibold">Operating Hours</h2>
          </div>

          <div className="space-y-3">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-28 font-medium capitalize">{day}</div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!profile.operatingHours[day].closed}
                    onChange={(e) => updateHours(day, 'closed', !e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-600">Open</span>
                </label>

                {!profile.operatingHours[day].closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={profile.operatingHours[day].open}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={profile.operatingHours[day].close}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                {profile.operatingHours[day].closed && (
                  <span className="text-sm text-gray-400">Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 p-2 rounded-lg">
              <FileText className="text-orange-600" size={24} />
            </div>
            <h2 className="text-lg font-semibold">Invoice Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={profile.invoicePrefix}
                onChange={(e) => updateField('invoicePrefix', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="INV"
              />
              <p className="text-xs text-gray-500 mt-1">Example: INV-2024-0001</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quote Prefix
              </label>
              <input
                type="text"
                value={profile.quotePrefix}
                onChange={(e) => updateField('quotePrefix', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="QT"
              />
              <p className="text-xs text-gray-500 mt-1">Example: QT-2024-0001</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profile.defaultTaxRate}
                  onChange={(e) => updateField('defaultTaxRate', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <DollarSign className="absolute right-3 top-2.5 text-gray-400" size={18} />
              </div>
              <p className="text-xs text-gray-500 mt-1">South Africa VAT: 15%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Terms (days)
              </label>
              <input
                type="number"
                min="0"
                value={profile.defaultPaymentTerms}
                onChange={(e) => updateField('defaultPaymentTerms', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Days until invoice is due</p>
            </div>
          </div>

          {/* Preview */}
          <div className="border-t pt-6 mt-6">
            <h3 className="font-medium text-gray-900 mb-4">Preview</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                Invoice: <span className="font-mono">{profile.invoicePrefix}-2024-0001</span>
              </p>
              <p className="text-sm text-gray-600">
                Quote: <span className="font-mono">{profile.quotePrefix}-2024-0001</span>
              </p>
              <p className="text-sm text-gray-600">
                Tax: <span className="font-mono">{profile.defaultTaxRate}%</span>
              </p>
              <p className="text-sm text-gray-600">
                Payment due: <span className="font-mono">{profile.defaultPaymentTerms} days</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Reset Settings?</h2>
                <p className="text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              This will reset all settings to default values. Your custom company information, 
              banking details, and operating hours will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
