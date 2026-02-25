# SendGrid Email Setup Guide

This guide explains how to set up SendGrid for email notifications in the Workshop Management System.

## Prerequisites

1. **SendGrid Account**: Sign up at [sendgrid.com](https://sendgrid.com) (free tier: 100 emails/day)
2. **Verified Sender Email**: You must verify a sender email address in SendGrid

## Setup Steps

### 1. Get API Key

1. Log in to SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Choose "Full Access" or "Restricted Access" with:
   - **Mail Send**: Full Access
   - **Template Engine**: Full Access
5. Copy the API key (it will only be shown once)

### 2. Configure Environment

Add your API key to `.env.local`:

```bash
VITE_SENDGRID_API_KEY=SG.your_actual_api_key_here
VITE_SENDGRID_FROM_EMAIL=your_verified_email@example.com
```

### 3. Start Email Server

```bash
# Terminal 1: Start the email server
npm run email-server

# Terminal 2: Start the frontend
npm run dev
```

## Email Features

The system supports these automated emails:

| Feature | Trigger |
|---------|---------|
| Job Status Updates | When job status changes |
| Invoice Delivery | When invoice is sent |
| Quote Delivery | When quote is created |
| Payment Confirmation | When payment is received |
| Appointment Reminders | 24 hours before appointment |
| Welcome Email | When new customer registers |

## Testing

### Test Email Server Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "sendgrid": true,
  "fromEmail": "your@email.com"
}
```

### Test Sending Email

```bash
curl -X POST http://localhost:3001/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "text": "This is a test",
    "html": "<p>This is a test</p>"
  }'
```

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Ensure `SENDGRID_API_KEY` is set correctly
2. **Verify Sender**: Ensure sender email is verified in SendGrid
3. **Check Logs**: Look at email server console for errors

### Rate Limiting

The free tier allows 100 emails/day. For higher limits:
- Upgrade to paid plan
- Or use multiple sender accounts

### Delivery Issues

- Check SendGrid **Activity Feed** in dashboard
- Verify email hasn't been blocked
- Check for spam folder on recipient side
