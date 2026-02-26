/**
 * SMS and WhatsApp Messaging Service
 * 
 * This service provides unified messaging capabilities for the Workshop Management System.
 * Supports SMS via Twilio and WhatsApp Business API.
 * 
 * Configuration:
 * - VITE_TWILIO_ACCOUNT_SID: Twilio Account SID
 * - VITE_TWILIO_AUTH_TOKEN: Twilio Auth Token
 * - VITE_TWILIO_PHONE_NUMBER: Twilio phone number for SMS
 * - VITE_TWILIO_WHATSAPP_NUMBER: Twilio WhatsApp business number
 */

export type MessageChannel = 'sms' | 'whatsapp';

export interface MessagePayload {
  to: string;
  message: string;
  channel: MessageChannel;
  templateId?: string;
  variables?: Record<string, string>;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  channel: MessageChannel;
  error?: string;
  timestamp: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: MessageChannel;
  content: string;
  variables: string[];
}

// Pre-defined message templates
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'job_received',
    name: 'Job Received',
    channel: 'sms',
    content: 'Hi {customerName}, your vehicle {vehicleReg} has been received. Job #{jobNumber}. We\'ll keep you updated. - {workshopName}',
    variables: ['customerName', 'vehicleReg', 'jobNumber', 'workshopName'],
  },
  {
    id: 'job_in_progress',
    name: 'Job In Progress',
    channel: 'sms',
    content: 'Hi {customerName}, work has started on your {vehicleReg}. Estimated completion: {dueDate}. Job #{jobNumber}. - {workshopName}',
    variables: ['customerName', 'vehicleReg', 'dueDate', 'jobNumber', 'workshopName'],
  },
  {
    id: 'job_awaiting_approval',
    name: 'Awaiting Approval',
    channel: 'sms',
    content: 'Hi {customerName}, your {vehicleReg} requires additional work. Total: R{totalCost}. Please reply YES to approve. Job #{jobNumber}. - {workshopName}',
    variables: ['customerName', 'vehicleReg', 'totalCost', 'jobNumber', 'workshopName'],
  },
  {
    id: 'job_ready',
    name: 'Job Ready',
    channel: 'sms',
    content: 'Hi {customerName}, your {vehicleReg} is ready for collection! Total: R{totalCost}. Operating hours: {hours}. Job #{jobNumber}. - {workshopName}',
    variables: ['customerName', 'vehicleReg', 'totalCost', 'hours', 'jobNumber', 'workshopName'],
  },
  {
    id: 'payment_reminder',
    name: 'Payment Reminder',
    channel: 'sms',
    content: 'Hi {customerName}, reminder: Invoice #{invoiceNumber} for R{totalCost} is due on {dueDate}. Pay via EFT or visit us. - {workshopName}',
    variables: ['customerName', 'invoiceNumber', 'totalCost', 'dueDate', 'workshopName'],
  },
  {
    id: 'service_reminder',
    name: 'Service Reminder',
    channel: 'whatsapp',
    content: 'Hello {customerName}! 🚗\n\nYour {vehicleReg} is due for a {serviceType}.\n\nWould you like to book an appointment?\n\nReply YES to schedule.\n\n- {workshopName}',
    variables: ['customerName', 'vehicleReg', 'serviceType', 'workshopName'],
  },
  {
    id: 'payment_confirmed',
    name: 'Payment Confirmed',
    channel: 'sms',
    content: 'Hi {customerName}, payment received for Invoice #{invoiceNumber}. Amount: R{totalCost}. Thank you! - {workshopName}',
    variables: ['customerName', 'invoiceNumber', 'totalCost', 'workshopName'],
  },
  {
    id: 'appointment_confirmation',
    name: 'Appointment Confirmation',
    channel: 'sms',
    content: 'Hi {customerName}, your appointment for {serviceType} is confirmed for {appointmentDate} at {appointmentTime}. - {workshopName}',
    variables: ['customerName', 'serviceType', 'appointmentDate', 'appointmentTime', 'workshopName'],
  },
  {
    id: 'welcome_customer',
    name: 'Welcome Customer',
    channel: 'sms',
    content: 'Welcome {customerName}! You\'re now registered with {workshopName}. We look forward to keeping your vehicle in top shape! 🚗',
    variables: ['customerName', 'workshopName'],
  },
];

class MessagingService {
  private serverUrl: string;
  private isConfigured = true; // Always route through backend server
  private pendingMessages: MessagePayload[] = [];

  constructor() {
    this.serverUrl = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';
  }

  /**
   * Format phone number to E.164 format (South African)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle South African numbers
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '27' + cleaned.slice(1);
    }
    
    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Render a template with variables
   */
  renderTemplate(templateId: string, variables: Record<string, string>): string | null {
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return null;

    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return content;
  }

  /**
   * Send a message via the specified channel
   */
  async sendMessage(payload: MessagePayload): Promise<MessageResult> {
    const timestamp = new Date().toISOString();
    const formattedPhone = this.formatPhoneNumber(payload.to);

    // If using a template, render it
    let message = payload.message;
    if (payload.templateId && payload.variables) {
      const rendered = this.renderTemplate(payload.templateId, payload.variables);
      if (rendered) message = rendered;
    }

    // Log the message for debugging
    console.log(`[MessagingService] ${payload.channel.toUpperCase()} to ${formattedPhone}:`, message);

    try {
      // Route through backend server (same as emailService)
      const endpoint = `${this.serverUrl}/api/messages/send`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formattedPhone,
          message,
          channel: payload.channel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        messageId: result.messageId,
        channel: payload.channel,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MessagingService] Error sending message:', errorMessage);
      
      // Queue for retry if offline
      if (!navigator.onLine) {
        this.pendingMessages.push(payload);
        console.log('[MessagingService] Message queued for retry when online');
      }

      return {
        success: false,
        channel: payload.channel,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Send SMS
   */
  async sendSMS(to: string, message: string): Promise<MessageResult> {
    return this.sendMessage({ to, message, channel: 'sms' });
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(to: string, message: string): Promise<MessageResult> {
    return this.sendMessage({ to, message, channel: 'whatsapp' });
  }

  /**
   * Send a templated message
   */
  async sendTemplatedMessage(
    to: string,
    templateId: string,
    variables: Record<string, string>,
    channel: MessageChannel = 'sms'
  ): Promise<MessageResult> {
    return this.sendMessage({
      to,
      message: '',
      channel,
      templateId,
      variables,
    });
  }

  /**
   * Process pending messages (call when coming back online)
   */
  async processPendingMessages(): Promise<MessageResult[]> {
    const results: MessageResult[] = [];
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];

    for (const payload of messages) {
      const result = await this.sendMessage(payload);
      results.push(result);
      
      // Re-queue if failed
      if (!result.success && !navigator.onLine) {
        this.pendingMessages.push(payload);
      }
    }

    return results;
  }

  /**
   * Get available templates for a channel
   */
  getTemplates(channel?: MessageChannel): MessageTemplate[] {
    if (channel) {
      return MESSAGE_TEMPLATES.filter(t => t.channel === channel);
    }
    return MESSAGE_TEMPLATES;
  }

  /**
   * Check if the service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get pending message count
   */
  getPendingCount(): number {
    return this.pendingMessages.length;
  }
}

// Export singleton instance
export const messagingService = new MessagingService();

// Also export the class for testing
export { MessagingService };
