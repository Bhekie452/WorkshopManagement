/**
 * Email Server - Express + SendGrid Integration
 * 
 * This server handles email sending via SendGrid API
 * Run with: npm run email-server
 * 
 * For production, deploy this as a serverless function (Vercel/Netlify)
 */

const express = require('express');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure SendGrid
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set - emails will be logged only');
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@workshop.co.za';

// Logging helper
const logEmail = (type, data) => {
  console.log(`\n📧 [${type}]`);
  console.log('To:', data.to);
  console.log('Subject:', data.subject);
  if (process.env.SENDGRID_API_KEY) {
    console.log('Status: Sent via SendGrid');
  } else {
    console.log('Status: Mock (no API key)');
    console.log('Content:', data.text || data.html?.substring(0, 100) + '...');
  }
  console.log('---');
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sendgrid: !!sendgridApiKey,
    fromEmail 
  });
});

// Send email endpoint
app.post('/api/send', async (req, res) => {
  const { to, subject, text, html, templateId, dynamicTemplateData, attachments } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ error: 'Missing required fields: to, subject' });
  }

  const msg = {
    to,
    from: fromEmail,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : html ? {} : { text: subject }),
    ...(templateId && { templateId }),
    ...(dynamicTemplateData && { dynamicTemplateData }),
    ...(attachments && { attachments }),
  };

  // Log the email
  logEmail('SEND', msg);

  // If no API key, simulate success
  if (!sendgridApiKey) {
    return res.json({ 
      success: true, 
      messageId: `mock-${Date.now()}`,
      mock: true 
    });
  }

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully');
    res.json({ 
      success: true, 
      messageId: `sent-${Date.now()}` 
    });
  } catch (error) {
    console.error('❌ SendGrid Error:', error.response?.body || error.message);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.response?.body || error.message 
    });
  }
});

// Send bulk emails
app.post('/api/send/bulk', async (req, res) => {
  const { emails } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Missing emails array' });
  }

  const results = [];
  
  for (const email of emails) {
    logEmail('BULK_SEND', email);
    
    if (!sendgridApiKey) {
      results.push({ to: email.to, success: true, mock: true });
      continue;
    }

    try {
      await sgMail.send({
        to: email.to,
        from: fromEmail,
        subject: email.subject,
        text: email.text || '',
        html: email.html || '',
      });
      results.push({ to: email.to, success: true });
    } catch (error) {
      results.push({ to: email.to, success: false, error: error.message });
    }
  }

  res.json({ results });
});

// PayFast ITN (Instant Transaction Notification) handler
app.post('/api/payment/notify', (req, res) => {
  console.log('\n💳 [PayFast ITN]');
  console.log('Payment notification received:', req.body);
  
  // In production, verify the payment with PayFast
  // Then update the invoice status in the database
  
  res.send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              📧 Email Server Started                       ║
╠═══════════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                              ║
║  SendGrid: ${sendgridApiKey ? '✅ Configured' : '❌ Not configured'}                      ║
║  From: ${fromEmail}                                       ║
╚═══════════════════════════════════════════════════════════╝

📌 Available Endpoints:
   POST /api/send      - Send single email
   POST /api/send/bulk - Send bulk emails
   POST /api/payment/notify - PayFast payment notification
   GET  /health        - Health check

📝 Setup:
   1. Copy .env.example to .env
   2. Add your SendGrid API key
   3. Verify your sender email in SendGrid
  `);
});
