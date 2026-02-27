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
    const passphrase = this.config.passphrase || '';
    const data = passphrase ? params + `&passphrase=${encodeURIComponent(passphrase)}` : params;
    
    // Use SubtleCrypto for MD5 — sync fallback for environments without it
    // For browser compatibility, use a simple MD5 implementation
    return this.md5(data);
  }

  /**
   * MD5 hash implementation for PayFast signature
   */
  private md5(input: string): string {
    // MD5 implementation
    function md5cycle(x: number[], k: number[]) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }
    function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    function add32(a: number, b: number) {
      return (a + b) & 0xFFFFFFFF;
    }

    const hex_chr = '0123456789abcdef'.split('');
    function rhex(n: number) {
      let s = '';
      for (let j = 0; j < 4; j++)
        s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
      return s;
    }

    function md5blks(s: string) {
      const n = s.length;
      const md5blk = new Array((((n + 8) >>> 6) + 1) * 16).fill(0);
      for (let i = 0; i < n; i++)
        md5blk[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      md5blk[n >> 2] |= 0x80 << ((n % 4) << 3);
      md5blk[md5blk.length - 2] = n * 8;
      return md5blk;
    }

    const blks = md5blks(input);
    const state = [1732584193, -271733879, -1732584194, 271733878];
    for (let i = 0; i < blks.length; i += 16)
      md5cycle(state, blks.slice(i, i + 16));
    return state.map(rhex).join('');
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
