import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { CompanyProfile } from '../types';
import { Collections } from './firestore';

const DEFAULT_PROFILE: Omit<CompanyProfile, 'createdAt' | 'updatedAt' | 'id'> = {
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

class CompanyProfileService {
  private getUid(explicitUid?: string): string {
    if (explicitUid) return explicitUid;
    const user = auth.currentUser;
    if (!user || !user.uid) {
      throw new Error("User not authenticated. Cannot perform profile operations.");
    }
    return user.uid;
  }

  private getDefaultProfile(uid: string): CompanyProfile {
    const now = new Date().toISOString();
    return {
      id: uid,
      ...DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getProfile(explicitUid?: string): Promise<CompanyProfile> {
    const uid = this.getUid(explicitUid);
    const docRef = doc(db, Collections.COMPANY_PROFILES, uid);
    
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as CompanyProfile;
      } else {
        // If no profile exists, create a default one
        const defaultProfile = this.getDefaultProfile(uid);
        await this.saveProfile(defaultProfile, uid);
        return defaultProfile;
      }
    } catch (error) {
      console.error("Error fetching company profile: ", error);
      // Fallback to default in case of error
      return this.getDefaultProfile(uid);
    }
  }

  async saveProfile(profile: Partial<CompanyProfile>, explicitUid?: string): Promise<CompanyProfile> {
    const uid = this.getUid(explicitUid);
    const docRef = doc(db, Collections.COMPANY_PROFILES, uid);
    
    const currentProfile = await this.getProfile(uid).catch(() => this.getDefaultProfile(uid));

    const updatedProfile: CompanyProfile = {
      ...currentProfile,
      ...profile,
      id: uid,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, updatedProfile, { merge: true });
    return updatedProfile;
  }

  async resetProfile(explicitUid?: string): Promise<CompanyProfile> {
    const uid = this.getUid(explicitUid);
    const docRef = doc(db, Collections.COMPANY_PROFILES, uid);
    const defaultProfile = this.getDefaultProfile(uid);

    // Overwrite with the default profile
    await setDoc(docRef, defaultProfile);
    return defaultProfile;
  }

  async getFormattedAddress(): Promise<string> {
    const profile = await this.getProfile();
    const { address } = profile;
    return `${address.street}, ${address.city}, ${address.province} ${address.postalCode}, ${address.country}`;
  }

  async getNextInvoiceNumber(lastNumber: number = 0): Promise<string> {
    const profile = await this.getProfile();
    const year = new Date().getFullYear();
    const num = String(lastNumber + 1).padStart(4, '0');
    return `${profile.invoicePrefix}-${year}-${num}`;
  }

  async getNextQuoteNumber(lastNumber: number = 0): Promise<string> {
    const profile = await this.getProfile();
    const year = new Date().getFullYear();
    const num = String(lastNumber + 1).padStart(4, '0');
    return `${profile.quotePrefix}-${year}-${num}`;
  }

  async isConfigured(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile.name !== 'My Workshop' || profile.contact.email !== 'info@workshop.co.za';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  }

  async calculateTax(subtotal: number): Promise<number> {
    const profile = await this.getProfile();
    return subtotal * (profile.defaultTaxRate / 100);
  }

  async getTaxRate(): Promise<number> {
    const profile = await this.getProfile();
    return profile.defaultTaxRate;
  }
}

export const companyProfile = new CompanyProfileService();
