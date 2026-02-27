/**
 * Email + Auth Server (Express)
 *
 * - SendGrid email endpoints
 * - Custom auth endpoints using bcrypt + JWT
 */

const express = require('express');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// ---------- Auth Config ----------
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || randomUUID() + randomUUID();
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || randomUUID() + randomUUID();
const REQUIRE_AUTH_FOR_EMAIL = process.env.REQUIRE_AUTH_FOR_EMAIL === 'true';

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const UserRole = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  TECHNICIAN: 'TECHNICIAN',
  RECEPTIONIST: 'RECEPTIONIST',
};

const Permission = {
  VIEW_JOBS: 'view_jobs',
  CREATE_JOB: 'create_job',
  EDIT_JOB: 'edit_job',
  DELETE_JOB: 'delete_job',
  VIEW_CUSTOMERS: 'view_customers',
  MANAGE_CUSTOMERS: 'manage_customers',
  VIEW_VEHICLES: 'view_vehicles',
  MANAGE_VEHICLES: 'manage_vehicles',
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  VIEW_INVOICES: 'view_invoices',
  MANAGE_INVOICES: 'manage_invoices',
  RUN_DIAGNOSTICS: 'run_diagnostics',
  VIEW_REPORTS: 'view_reports',
  VIEW_SCHEDULE: 'view_schedule',
  MANAGE_SCHEDULE: 'manage_schedule',
  VIEW_EV_FLEET: 'view_ev_fleet',
  VIEW_SETTINGS: 'view_settings',
  MANAGE_TEAM: 'manage_team',
};

const ROLE_PERMISSIONS = {
  [UserRole.SYSTEM_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MANAGER]: [
    Permission.VIEW_JOBS, Permission.CREATE_JOB, Permission.EDIT_JOB, Permission.DELETE_JOB,
    Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_VEHICLES, Permission.MANAGE_VEHICLES,
    Permission.VIEW_INVENTORY, Permission.MANAGE_INVENTORY,
    Permission.VIEW_INVOICES, Permission.MANAGE_INVOICES,
    Permission.RUN_DIAGNOSTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_SCHEDULE, Permission.MANAGE_SCHEDULE,
    Permission.VIEW_EV_FLEET,
    Permission.VIEW_SETTINGS,
  ],
  [UserRole.TECHNICIAN]: [
    Permission.VIEW_JOBS, Permission.CREATE_JOB, Permission.EDIT_JOB,
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_VEHICLES,
    Permission.VIEW_INVENTORY,
    Permission.RUN_DIAGNOSTICS,
    Permission.VIEW_SCHEDULE,
    Permission.VIEW_SETTINGS,
  ],
  [UserRole.RECEPTIONIST]: [
    Permission.VIEW_JOBS, Permission.CREATE_JOB,
    Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_VEHICLES,
    Permission.VIEW_INVOICES, Permission.MANAGE_INVOICES,
    Permission.VIEW_SCHEDULE, Permission.MANAGE_SCHEDULE,
    Permission.VIEW_SETTINGS,
  ],
};

// ---------- Middleware ----------
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://workshop-d1832.web.app,https://workshop-d1832.firebaseapp.com').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Log but allow in dev; tighten in production
      console.warn(`CORS: request from unknown origin ${origin}`);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ---------- Rate Limiting ----------
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window for auth endpoints

const rateLimit = (maxRequests = RATE_LIMIT_MAX) => (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, start: now };
  
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.start = now;
  } else {
    entry.count++;
  }
  rateLimitMap.set(key, entry);
  
  if (entry.count > maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
};

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// ---------- Input Sanitization ----------
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim();
};

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  next();
};

app.use(sanitizeBody);

// ---------- File Store ----------
const ensureUserStore = () => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
};

const readUsers = () => {
  ensureUserStore();
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  const data = JSON.parse(raw || '{"users":[]}');
  if (!Array.isArray(data.users)) data.users = [];
  return data;
};

const writeUsers = (data) => {
  ensureUserStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  createdAt: user.createdAt,
  permissions: ROLE_PERMISSIONS[user.role] || [],
});

const signAccessToken = (user) => jwt.sign({
  sub: user.id,
  email: user.email,
  role: user.role,
  permissions: ROLE_PERMISSIONS[user.role] || [],
  type: 'access',
}, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

const signRefreshToken = (userId, sessionId) => jwt.sign({
  sub: userId,
  sid: sessionId,
  type: 'refresh',
}, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

const decodeTokenUnsafe = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const optionalEmailAuth = (req, res, next) => {
  if (!REQUIRE_AUTH_FOR_EMAIL) return next();
  return verifyAccessToken(req, res, next);
};

// ---------- SendGrid ----------
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set - emails will be logged only');
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@workshop.co.za';

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

// ---------- Health ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sendgrid: !!sendgridApiKey,
    fromEmail,
    auth: {
      enabled: true,
      requireAuthForEmail: REQUIRE_AUTH_FOR_EMAIL,
    },
  });
});

// ---------- Auth Endpoints ----------
app.post('/api/auth/signup', rateLimit(10), async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const nextRole = Object.values(UserRole).includes(role) ? role : UserRole.TECHNICIAN;

    const data = readUsers();
    const existing = data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id: randomUUID(),
      name,
      email: String(email).toLowerCase(),
      role: nextRole,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      passwordHash,
      sessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sessionId = randomUUID();
    const refreshToken = signRefreshToken(user.id, sessionId);
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const decoded = decodeTokenUnsafe(refreshToken);

    user.sessions.push({
      id: sessionId,
      refreshHash,
      createdAt: new Date().toISOString(),
      expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    });

    data.users.push(user);
    writeUsers(data);

    const accessToken = signAccessToken(user);

    return res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to sign up user' });
  }
});

app.post('/api/auth/login', rateLimit(15), async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const data = readUsers();
    const user = data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.sessions = Array.isArray(user.sessions) ? user.sessions : [];

    const sessionId = randomUUID();
    const refreshToken = signRefreshToken(user.id, sessionId);
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const decoded = decodeTokenUnsafe(refreshToken);

    user.sessions.push({
      id: sessionId,
      refreshHash,
      createdAt: new Date().toISOString(),
      expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    });

    // Trim stale sessions
    user.sessions = user.sessions.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > Date.now()).slice(-10);
    user.updatedAt = new Date().toISOString();
    writeUsers(data);

    const accessToken = signAccessToken(user);

    return res.json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to sign in user' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refreshToken' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (!payload || payload.type !== 'refresh' || !payload.sub || !payload.sid) {
      return res.status(401).json({ error: 'Invalid refresh token payload' });
    }

    const data = readUsers();
    const user = data.users.find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    user.sessions = Array.isArray(user.sessions) ? user.sessions : [];
    const session = user.sessions.find((s) => s.id === payload.sid);
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const matched = await bcrypt.compare(refreshToken, session.refreshHash || '');
    if (!matched) {
      return res.status(401).json({ error: 'Refresh token mismatch' });
    }

    const newSessionId = randomUUID();
    const newRefreshToken = signRefreshToken(user.id, newSessionId);
    const newRefreshHash = await bcrypt.hash(newRefreshToken, 10);
    const newDecoded = decodeTokenUnsafe(newRefreshToken);

    user.sessions = user.sessions
      .filter((s) => s.id !== session.id)
      .filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > Date.now());

    user.sessions.push({
      id: newSessionId,
      refreshHash: newRefreshHash,
      createdAt: new Date().toISOString(),
      expiresAt: newDecoded?.exp ? new Date(newDecoded.exp * 1000).toISOString() : null,
    });

    user.updatedAt = new Date().toISOString();
    writeUsers(data);

    const accessToken = signAccessToken(user);

    return res.json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.json({ success: true });
    }

    let payload = null;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch {
      return res.json({ success: true });
    }

    if (!payload?.sub || !payload?.sid) {
      return res.json({ success: true });
    }

    const data = readUsers();
    const user = data.users.find((u) => u.id === payload.sub);
    if (user && Array.isArray(user.sessions)) {
      user.sessions = user.sessions.filter((s) => s.id !== payload.sid);
      user.updatedAt = new Date().toISOString();
      writeUsers(data);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

app.get('/api/auth/me', verifyAccessToken, (req, res) => {
  const data = readUsers();
  const user = data.users.find((u) => u.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: sanitizeUser(user) });
});

// ---------- Email Endpoints ----------
app.post('/api/send', optionalEmailAuth, async (req, res) => {
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

  logEmail('SEND', msg);

  if (!sendgridApiKey) {
    return res.json({
      success: true,
      messageId: `mock-${Date.now()}`,
      mock: true,
    });
  }

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully');
    return res.json({
      success: true,
      messageId: `sent-${Date.now()}`,
    });
  } catch (error) {
    console.error('❌ SendGrid Error:', error.response?.body || error.message);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.response?.body || error.message,
    });
  }
});

app.post('/api/send/bulk', optionalEmailAuth, async (req, res) => {
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

  return res.json({ results });
});

app.post('/api/payment/notify', optionalEmailAuth, (req, res) => {
  console.log('\n💳 [PayFast ITN]');
  console.log('Payment notification received:', req.body);
  return res.send('OK');
});

// ---------- Messaging (SMS/WhatsApp via Twilio) ----------
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient = null;
if (twilioAccountSid && twilioAuthToken) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    console.log('✅ Twilio configured');
  } catch (err) {
    console.warn('⚠️ Twilio not configured:', err.message);
  }
}

app.post('/api/messages/send', optionalEmailAuth, async (req, res) => {
  const { to, message, channel = 'sms' } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' });
  }

  console.log(`\n📱 [Messaging] Sending ${channel.toUpperCase()} to ${to}`);

  // If Twilio not configured, log and return mock success
  if (!twilioClient) {
    console.log('⚠️ Twilio not configured - message logged but not sent');
    console.log('Message:', message);
    return res.json({
      success: true,
      messageId: `mock-${Date.now()}`,
      channel,
      note: 'Twilio not configured - message logged only',
    });
  }

  try {
    let result;
    if (channel === 'whatsapp') {
      // Send WhatsApp via Twilio
      result = await twilioClient.messages.create({
        body: message,
        from: `whatsapp:${twilioWhatsAppNumber || twilioPhoneNumber}`,
        to: `whatsapp:${to}`,
      });
    } else {
      // Send SMS via Twilio
      result = await twilioClient.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: to,
      });
    }

    console.log(`✅ Message sent: ${result.sid}`);
    return res.json({
      success: true,
      messageId: result.sid,
      channel,
      status: result.status,
    });
  } catch (error) {
    console.error(`❌ Failed to send ${channel}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      channel,
    });
  }
});

app.post('/api/messages/bulk', optionalEmailAuth, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  console.log(`\n📱 [Messaging] Sending ${messages.length} bulk messages`);

  const results = [];
  for (const msg of messages) {
    const { to, message, channel = 'sms' } = msg;

    if (!twilioClient) {
      results.push({ to, success: true, messageId: `mock-${Date.now()}`, channel });
      continue;
    }

    try {
      let result;
      if (channel === 'whatsapp') {
        result = await twilioClient.messages.create({
          body: message,
          from: `whatsapp:${twilioWhatsAppNumber || twilioPhoneNumber}`,
          to: `whatsapp:${to}`,
        });
      } else {
        result = await twilioClient.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: to,
        });
      }
      results.push({ to, success: true, messageId: result.sid, channel });
    } catch (error) {
      results.push({ to, success: false, error: error.message, channel });
    }
  }

  return res.json({ results });
});

// ---------- Start ----------
app.listen(PORT, () => {
  ensureUserStore();
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║      📧 Email + Messaging + Auth Server Started           ║
╠═══════════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                              ║
║  SendGrid: ${sendgridApiKey ? '✅ Configured' : '❌ Not configured'}                      ║
║  Twilio: ${twilioClient ? '✅ Configured' : '❌ Not configured'}                        ║
║  Auth: ✅ bcrypt + JWT enabled                            ║
╚═══════════════════════════════════════════════════════════╝

📌 Available Endpoints:
   POST /api/auth/signup
   POST /api/auth/login
   POST /api/auth/refresh
   POST /api/auth/logout
   GET  /api/auth/me
   POST /api/send
   POST /api/send/bulk
   POST /api/messages/send
   POST /api/messages/bulk
   POST /api/payment/notify
   GET  /health
  `);
});
