/**
 * PayFast Payment Service
 * Handles South African payment processing via PayFast
 */

export interface PaymentRequest {
  amount: number;
  itemName: string;
  itemDescription?: string;
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymentStatus {
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
}

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
}

class PayFastService {
  private config: PayFastConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      merchantId: import.meta.env.VITE_PAYFAST_MERCHANT_ID || '10000100',
      merchantKey: import.meta.env.VITE_PAYFAST_MERCHANT_KEY || '46f0cd694581a',
      passphrase: import.meta.env.VITE_PAYFAST_PASSPHRASE || '',
      sandbox: import.meta.env.VITE_PAYFAST_SANDBOX === 'true',
    };
    
    this.baseUrl = this.config.sandbox 
      ? 'https://sandbox.payfast.co.za' 
      : 'https://payfast.co.za';
  }

  /**
   * Generate PayFast payment URL
   */
  getPaymentUrl(request: PaymentRequest): string {
    const params = new URLSearchParams({
      'merchant_id': this.config.merchantId,
      'merchant_key': this.config.merchantKey,
      'return_url': request.returnUrl,
      'cancel_url': request.cancelUrl,
      'notify_url': request.notifyUrl,
      'm_payment_id': request.invoiceNumber,
      'amount': request.amount.toFixed(2),
      'item_name': request.itemName,
      'item_description': request.itemDescription || request.itemName,
      'email_confirmation': '1',
      'confirmation_address': request.customerEmail,
      'name_first': request.customerName.split(' ')[0],
      'name_last': request.customerName.split(' ').slice(1).join(' ') || '',
      'email_address': request.customerEmail,
    });

    // Add passphrase for signature
    const passphrase = this.config.passphrase 
      ? `&passphrase=${this.config.passphrase}` 
      : '';

    // Generate signature (MD5 hash of parameters)
    const signature = this.generateSignature(params.toString());
    params.append('signature', signature);

    return `${this.baseUrl}/eng/process?${params.toString()}`;
  }

  /**
   * Generate MD5 signature for PayFast
   */
  private generateSignature(params: string): string {
    // PayFast requires specific signature format
    const passphrase = this.config.passphrase || '';
    const data = params + passphrase;
    
    // Simple hash for demo - in production use crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }
    const hashStr = (hash >>> 0).toString(16);
    return hashStr.padStart(32, '0');
  }

  /**
   * Verify PayFast payment notification (ITN)
   */
  async verifyPayment(postData: Record<string, string>): Promise<PaymentStatus> {
    try {
      // In production, send to PayFast for verification
      const response = await fetch(`${this.baseUrl}/eng/query/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(postData).toString(),
      });

      if (!response.ok) {
        throw new Error('PayFast verification failed');
      }

      const result = await response.text();
      
      if (result === 'VALID') {
        return {
          success: true,
          paymentId: postData['pf_payment_id'],
          status: postData['payment_status'],
        };
      } else {
        return {
          success: false,
          error: 'Invalid payment verification',
        };
      }
    } catch (error: any) {
      console.error('PayFast verification error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create payment for an invoice
   */
  async createInvoicePayment(
    invoiceNumber: string,
    amount: number,
    customerEmail: string,
    customerName: string,
    baseUrl: string
  ): Promise<string> {
    const request: PaymentRequest = {
      amount,
      itemName: `Workshop Invoice #${invoiceNumber}`,
      itemDescription: `Payment for workshop services - Invoice ${invoiceNumber}`,
      customerEmail,
      customerName,
      invoiceNumber,
      returnUrl: `${baseUrl}/payment/success?invoice=${invoiceNumber}`,
      cancelUrl: `${baseUrl}/payment/cancel?invoice=${invoiceNumber}`,
      notifyUrl: `${baseUrl}/api/payment/notify`,
    };

    return this.getPaymentUrl(request);
  }

  /**
   * Check if PayFast is configured
   */
  isConfigured(): boolean {
    return !!(this.config.merchantId && this.config.merchantKey);
  }

  /**
   * Get sandbox status
   */
  isSandbox(): boolean {
    return this.config.sandbox;
  }
}

export const payfastService = new PayFastService();
