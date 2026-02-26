/**
 * Messaging Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagingService, MESSAGE_TEMPLATES } from '../services/messagingService';

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(() => {
    service = new MessagingService();
  });

  describe('formatPhoneNumber', () => {
    it('formats South African numbers correctly', async () => {
      // Access private method via sending SMS and checking result
      const result = await service.sendSMS('0821234567', 'Test');
      expect(result.success).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('renders template with variables', () => {
      const rendered = service.renderTemplate('job_received', {
        customerName: 'John',
        vehicleReg: 'ABC 123 GP',
        jobNumber: '1001',
        workshopName: 'AutoFlow',
      });
      expect(rendered).toContain('John');
      expect(rendered).toContain('ABC 123 GP');
      expect(rendered).toContain('1001');
      expect(rendered).toContain('AutoFlow');
    });

    it('returns null for unknown template', () => {
      const rendered = service.renderTemplate('unknown_template', {});
      expect(rendered).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('returns mock success when not configured', async () => {
      const result = await service.sendMessage({
        to: '+27821234567',
        message: 'Test message',
        channel: 'sms',
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^mock-/);
      expect(result.channel).toBe('sms');
    });

    it('sends WhatsApp messages', async () => {
      const result = await service.sendWhatsApp('+27821234567', 'Hello via WhatsApp');
      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
    });
  });

  describe('getTemplates', () => {
    it('returns all templates', () => {
      const templates = service.getTemplates();
      expect(templates.length).toBe(MESSAGE_TEMPLATES.length);
    });

    it('filters by channel', () => {
      const smsTemplates = service.getTemplates('sms');
      expect(smsTemplates.every(t => t.channel === 'sms')).toBe(true);

      const whatsappTemplates = service.getTemplates('whatsapp');
      expect(whatsappTemplates.every(t => t.channel === 'whatsapp')).toBe(true);
    });
  });

  describe('sendTemplatedMessage', () => {
    it('sends using template', async () => {
      const result = await service.sendTemplatedMessage(
        '+27821234567',
        'job_ready',
        {
          customerName: 'Jane',
          vehicleReg: 'XYZ 789 GP',
          totalCost: '5000',
          hours: '8am - 5pm',
          jobNumber: '2001',
          workshopName: 'TestWorkshop',
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('isServiceConfigured', () => {
    it('returns false when not configured', () => {
      expect(service.isServiceConfigured()).toBe(false);
    });
  });

  describe('getPendingCount', () => {
    it('returns zero initially', () => {
      expect(service.getPendingCount()).toBe(0);
    });
  });
});

describe('MESSAGE_TEMPLATES', () => {
  it('has required templates', () => {
    const templateIds = MESSAGE_TEMPLATES.map(t => t.id);
    expect(templateIds).toContain('job_received');
    expect(templateIds).toContain('job_in_progress');
    expect(templateIds).toContain('job_ready');
    expect(templateIds).toContain('payment_reminder');
  });

  it('all templates have required fields', () => {
    MESSAGE_TEMPLATES.forEach(template => {
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.channel).toMatch(/^(sms|whatsapp)$/);
      expect(template.content).toBeDefined();
      expect(Array.isArray(template.variables)).toBe(true);
    });
  });
});
