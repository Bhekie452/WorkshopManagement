<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Workshop Management System (W.M.S.)

A comprehensive, modern workshop management solution for automotive service centers. Built with React 19, TypeScript, and powered by AI.

## 🚀 Features

### Core Modules
- **Job Management** - Track repairs, maintenance, and diagnostics
- **Customer Portal** - Manage customer profiles and vehicle history
- **Inventory Control** - Parts tracking and stock management
- **Sales & Invoicing** - Professional quotes and invoices with PayFast integration

### AI & Automation
- **AI Diagnostics** - Google Gemini-powered vehicle diagnostics
- **Email Notifications** - Automated customer emails via SendGrid
- **Voice Assistant** - Hands-free operation for busy workshops

### Specialized
- **EV Fleet Management** - Electric vehicle monitoring and analytics
- **Schedule/Calendar** - Appointment booking and management
- **Analytics Dashboard** - Business insights and reporting

## 📋 Prerequisites

- Node.js 18+ and npm
- SendGrid account (free tier available)
- Google Gemini API key (optional, for AI features)
- PayFast account (optional, for payments)

## 🛠️ Installation

### 1. Clone and Install
```bash
git clone <repository-url>
cd workshop-manage
npm install
```

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Required for AI diagnostics
VITE_GEMINI_API_KEY=your_gemini_api_key

# Required for email notifications
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=info@wms.co.za
VITE_EMAIL_SERVER_URL=http://localhost:3001

# Optional: PayFast payments
VITE_PAYFAST_MERCHANT_ID=10000100
VITE_PAYFAST_MERCHANT_KEY=46f0cd694581a
VITE_PAYFAST_PASSPHRASE=your_passphrase
VITE_PAYFAST_SANDBOX=true
```

### 3. Start Development Servers

**Terminal 1 - Main Application:**
```bash
npm run dev
```

**Terminal 2 - Email Server:**
```bash
npm run email-server
```

Open http://localhost:3000

## 📧 Email Setup

The system uses SendGrid for professional email delivery. See [SENDGRID_SETUP.md](SENDGRID_SETUP.md) for detailed setup instructions.

**Quick Setup:**
1. Sign up at SendGrid.com (free tier: 100 emails/day)
2. Create API key and verify sender email
3. Add credentials to `.env.local`
4. Start email server: `npm run email-server`

## 💳 Payment Setup

PayFast integration for South African payments. See [PAYFAST_SETUP.md](PAYFAST_SETUP.md) for setup guide.

**Sandbox Mode (Testing):**
- Already configured with test credentials
- Use test card: `4000 0000 0000 0002`

## 🏢 Company Profile

Configure your workshop details:
1. Go to Settings in the app
2. Update company information, banking details, and business hours
3. Click Save Changes

This information appears on:
- Invoices and quotes
- Email signatures
- Customer communications

## 📱 Features Overview

### Job Management
- Create and track repair jobs
- Task checklists with progress tracking
- Priority levels and status updates
- Job costing and time tracking

### Customer Management
- Complete customer profiles
- Vehicle history tracking
- Communication logs
- Automated email notifications

### Inventory
- Parts catalog with SKU management
- Stock level tracking
- Low stock alerts
- Supplier management

### Sales & Invoicing
- Professional invoice generation
- Quote creation and conversion
- PayFast payment integration
- Automated email delivery
- Banking details on invoices

### AI Diagnostics
- Google Gemini-powered analysis
- Symptom-based diagnostics
- Repair recommendations
- Cost estimates

### Voice Assistant
- Hands-free operation
- Voice commands for common tasks
- Workshop-optimized commands

## 🚀 Deployment

### Firebase Hosting
```bash
# Build and deploy
npm run deploy
```

### Email Server Deployment

**Option 1: Same Server**
```bash
npm run build
npm run email-server &
npx serve -s dist
```

**Option 2: Serverless (Recommended)**
Deploy email server as Netlify/Vercel function. See SENDGRID_SETUP.md for details.

## 📂 Project Structure

```
workshop-manage/
├── pages/              # Main application pages
├── components/         # Reusable React components
├── services/           # Business logic and APIs
│   ├── store.ts       # Data management (localStorage)
│   ├── emailService.ts # SendGrid integration
│   ├── payfast.ts     # Payment processing
│   └── companyProfile.ts # Company settings
├── server/            # Email server (Express)
│   ├── emailServer.js # SendGrid API endpoint
│   └── package.json   # Server dependencies
├── types.ts           # TypeScript definitions
└── App.tsx            # Main app component
```

## 🔧 Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run email-server` | Start email server |
| `npm run deploy` | Deploy to Firebase |

## 🐛 Troubleshooting

### Email Server Not Starting
```bash
# Check if dependencies are installed
cd server && npm install

# Verify environment variables
type .env.local | findstr SENDGRID

# Check if port 3001 is available
netstat -ano | findstr :3001
```

### Emails Not Sending
- Verify SendGrid API key is valid
- Check sender email is verified in SendGrid dashboard
- Ensure email server is running
- Check browser console for errors

### PayFast Payments Not Working
- Verify sandbox mode is enabled for testing
- Check merchant credentials in `.env.local`
- Use test card: `4000 0000 0000 0002`
- Review PayFast dashboard for transaction logs

## 📚 Documentation

- [SendGrid Setup Guide](SENDGRID_SETUP.md)
- [PayFast Setup Guide](PAYFAST_SETUP.md)

## 🔒 Security

- Never commit `.env.local` to git (already in `.gitignore`)
- Keep API keys secure and rotate regularly
- Use environment variables for all secrets
- Enable domain authentication in SendGrid
- Use restricted API keys with minimal permissions

## 📄 License

Private - All Rights Reserved

## 🤝 Support

For issues or questions:

- Check documentation files
- Review console logs for errors
- Verify environment configuration
- Check service status pages (SendGrid, PayFast)

---

Built with ❤️ for automotive workshops
