/**
 * Company Profile Service
 * Manages workshop company information for invoices, emails, and documents
 */

export interface CompanyProfile {
  id: string;
  name: string;
  tagline?: string;
  registrationNumber?: string;
  vatNumber?: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    alternativePhone?: string;
    email: string;
    website?: string;
  };
  banking: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
  };
  operatingHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  logo?: string;
  defaultTaxRate: number;
  defaultPaymentTerms: number; // days
  invoicePrefix: string;
  quotePrefix: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROFILE: Omit<CompanyProfile, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string } = {
  id: 'default',
  name: 'My Workshop',
  tagline: 'Professional Auto Services',
  address: {
    street: '123 Main Street',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2000',
    country: 'South Africa',
  },
  contact: {
    phone: '011 555 0000',
    email: 'info@workshop.co.za',
  },
  banking: {
    bankName: 'First National Bank',
    accountName: 'My Workshop Pty Ltd',
    accountNumber: '1234567890',
    branchCode: '250655',
    accountType: 'Business Current',
  },
  operatingHours: {
    monday: { open: '08:00', close: '17:00', closed: false },
    tuesday: { open: '08:00', close: '17:00', closed: false },
    wednesday: { open: '08:00', close: '17:00', closed: false },
    thursday: { open: '08:00', close: '17:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '08:00', close: '13:00', closed: false },
    sunday: { open: '', close: '', closed: true },
  },
  defaultTaxRate: 15, // South Africa VAT
  defaultPaymentTerms: 30,
  invoicePrefix: 'INV',
  quotePrefix: 'QT',
};

const STORAGE_KEY = 'companyProfile';

class CompanyProfileService {
  /**
   * Get company profile from localStorage
   */
  getProfile(): CompanyProfile {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.getDefaultProfile();
      }
    }
    return this.getDefaultProfile();
  }

  private getDefaultProfile(): CompanyProfile {
    return {
      ...DEFAULT_PROFILE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save company profile to localStorage
   */
  saveProfile(profile: Partial<CompanyProfile>): CompanyProfile {
    const current = this.getProfile();
    const updated: CompanyProfile = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  /**
   * Reset to default profile
   */
  resetProfile(): CompanyProfile {
    const defaultWithDate = {
      ...DEFAULT_PROFILE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultWithDate));
    return defaultWithDate;
  }

  /**
   * Get formatted address
   */
  getFormattedAddress(): string {
    const profile = this.getProfile();
    const { address } = profile;
    return `${address.street}, ${address.city}, ${address.province} ${address.postalCode}, ${address.country}`;
  }

  /**
   * Get formatted contact info
   */
  getFormattedContact(): string {
    const profile = this.getProfile();
    const { contact } = profile;
    let info = `Tel: ${contact.phone}`;
    if (contact.alternativePhone) {
      info += ` / ${contact.alternativePhone}`;
    }
    info += `\nEmail: ${contact.email}`;
    if (contact.website) {
      info += `\nWeb: ${contact.website}`;
    }
    return info;
  }

  /**
   * Get formatted banking details
   */
  getFormattedBanking(): string {
    const profile = this.getProfile();
    const { banking } = profile;
    return `${banking.bankName}\nAccount: ${banking.accountName}\nAcc#: ${banking.accountNumber}\nBranch: ${banking.branchCode} (${banking.accountType})`;
  }

  /**
   * Get next invoice number
   */
  getNextInvoiceNumber(lastNumber: number = 0): string {
    const profile = this.getProfile();
    const year = new Date().getFullYear();
    const num = String(lastNumber + 1).padStart(4, '0');
    return `${profile.invoicePrefix}-${year}-${num}`;
  }

  /**
   * Get next quote number
   */
  getNextQuoteNumber(lastNumber: number = 0): string {
    const profile = this.getProfile();
    const year = new Date().getFullYear();
    const num = String(lastNumber + 1).padStart(4, '0');
    return `${profile.quotePrefix}-${year}-${num}`;
  }

  /**
   * Check if profile is configured (has real data)
   */
  isConfigured(): boolean {
    const profile = this.getProfile();
    return profile.name !== 'My Workshop' || profile.contact.email !== 'info@workshop.co.za';
  }

  /**
   * Format currency (ZAR)
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  }

  /**
   * Calculate tax amount
   */
  calculateTax(subtotal: number): number {
    const profile = this.getProfile();
    return subtotal * (profile.defaultTaxRate / 100);
  }

  /**
   * Get tax rate
   */
  getTaxRate(): number {
    return this.getProfile().defaultTaxRate;
  }
}

export const companyProfile = new CompanyProfileService();
