/**
 * Email Service - SendGrid Integration
 * Handles all email notifications for the workshop management system
 */

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  content: string;  // Base64
  filename: string;
  type: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

class EmailService {
  private serverUrl: string;
  private isConfigured: boolean = false;
  private company: CompanyInfo = {
    name: 'My Workshop',
    email: 'info@workshop.co.za',
    phone: '011 555 0000',
    address: '',
  };

  constructor() {
    // Get email server URL from environment
    this.serverUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';
    this.isConfigured = !!this.serverUrl;
  }

  /**
   * Update company info used in email headers and signatures.
   * Call this once after loading the CompanyProfile from Firestore.
   */
  setCompanyInfo(info: Partial<CompanyInfo>): void {
    this.company = { ...this.company, ...info };
  }

  private getEmailHeader(): string {
    return `<h2 style="color: #2563eb;">${this.company.name}</h2>`;
  }

  private getEmailSignature(): string {
    const lines = [
      `Best regards,`,
      `<strong>${this.company.name}</strong>`,
      this.company.phone ? `Tel: ${this.company.phone}` : '',
      this.company.email ? `Email: <a href="mailto:${this.company.email}">${this.company.email}</a>` : '',
      this.company.address ? this.company.address : '',
    ].filter(Boolean).join('<br>');
    return `<p style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; color: #6b7280; font-size: 0.875rem;">${lines}</p>`;
  }

  /**
   * Send an email via the local email server
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.isConfigured) {
      console.warn('Email server not configured. Email will be logged to console.');
      console.log('📧 [Mock Email]', {
        to: options.to,
        subject: options.subject,
        text: options.text,
      });
      // Return success in development mode
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Email server error: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send job status notification to customer
   */
  async sendJobStatusUpdate(
    customerEmail: string,
    customerName: string,
    jobId: string,
    status: string,
    vehicleInfo: string
  ): Promise<EmailResult> {
    const statusMessages: Record<string, string> = {
      'Pending': 'Your vehicle has been received and is awaiting inspection.',
      'In Progress': 'Our technicians are currently working on your vehicle.',
      'Awaiting Parts': 'We are waiting for parts to arrive. We will contact you once they are in.',
      'Awaiting Approval': 'Please review the quoted work and provide approval.',
      'Invoiced': 'Your invoice has been generated. Please review and arrange payment.',
      'Paid': 'Thank you for your payment. Your vehicle is being prepared for collection.',
      'Completed': 'Your vehicle is ready for collection. Please contact us to arrange pickup.',
      'Cancelled': 'Your job has been cancelled. Please contact us if you have any questions.',
    };

    return this.send({
      to: customerEmail,
      subject: `Job Update - ${jobId} - ${vehicleInfo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${this.getEmailHeader()}
          <p>Dear ${customerName},</p>
          <p>${statusMessages[status] || 'There has been an update to your job.'}</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Job ID:</strong> ${jobId}</p>
            <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
            <p><strong>Status:</strong> ${status}</p>
          </div>
          
          <p>You can log in to your customer portal to view more details about your job.</p>
          
          ${this.getEmailSignature()}
        </div>
      `,
    });
  }

  /**
   * Send invoice/quote to customer
   */
  async sendInvoice(
    customerEmail: string,
    customerName: string,
    invoiceNumber: string,
    amount: number,
    dueDate: string,
    isQuote: boolean = false
  ): Promise<EmailResult> {
    const docType = isQuote ? 'Quote' : 'Invoice';
    
    return this.send({
      to: customerEmail,
      subject: `${docType} #${invoiceNumber} - ${isQuote ? 'Request for Approval' : 'Payment Required'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${this.getEmailHeader()}
          <p>Dear ${customerName},</p>
          <p>Please find attached your ${docType.toLowerCase()} for services rendered.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>${docType} Number:</strong> ${invoiceNumber}</p>
            <p><strong>Amount:</strong> R${amount.toFixed(2)}</p>
            <p><strong>${isQuote ? 'Valid Until' : 'Due Date'}:</strong> ${new Date(dueDate).toLocaleDateString('en-ZA')}</p>
          </div>
          
          ${!isQuote ? `
          <p>To pay online, please click the payment link in your customer portal or contact us.</p>
          ` : `
          <p>To approve this quote, please log in to your customer portal or contact us.</p>
          `}
          
          ${this.getEmailSignature()}
        </div>
      `,
    });
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    customerEmail: string,
    customerName: string,
    appointmentDate: string,
    serviceType: string,
    vehicleInfo: string
  ): Promise<EmailResult> {
    return this.send({
      to: customerEmail,
      subject: `Appointment Reminder - ${serviceType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${this.getEmailHeader()}
          <p>Dear ${customerName},</p>
          <p>This is a friendly reminder about your upcoming appointment.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleString('en-ZA')}</p>
            <p><strong>Service:</strong> ${serviceType}</p>
            <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
          </div>
          
          <p>Please ensure your vehicle is available at the scheduled time.</p>
          <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
          
          ${this.getEmailSignature()}
        </div>
      `,
    });
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    customerEmail: string,
    customerName: string,
    invoiceNumber: string,
    amount: number,
    paymentMethod: string
  ): Promise<EmailResult> {
    return this.send({
      to: customerEmail,
      subject: `Payment Confirmed - Invoice #${invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${this.getEmailHeader()}
          <p>Dear ${customerName},</p>
          <p>Thank you for your payment. Here are your payment details:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p><strong>Amount Paid:</strong> R${amount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-ZA')}</p>
          </div>
          
          <p>Your vehicle is being prepared for collection. We will contact you once it is ready.</p>
          
          ${this.getEmailSignature()}
        </div>
      `,
    });
  }

  /**
   * Send welcome email to new customers
   */
  async sendWelcomeEmail(
    customerEmail: string,
    customerName: string
  ): Promise<EmailResult> {
    return this.send({
      to: customerEmail,
      subject: 'Welcome to Our Workshop Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to ${this.company.name}!</h2>
          <p>Dear ${customerName},</p>
          <p>Thank you for registering with us. You can now:</p>
          
          <ul>
            <li>Track your vehicle's service history</li>
            <li>View and pay your invoices online</li>
            <li>Schedule appointments</li>
            <li>Receive real-time job status updates</li>
          </ul>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          ${this.getEmailSignature()}
        </div>
      `,
    });
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
