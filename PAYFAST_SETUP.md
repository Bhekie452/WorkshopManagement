# PayFast Payment Setup Guide

This guide explains how to set up PayFast for online payments in the Workshop Management System.

## What is PayFast?

PayFast is a South African payment processor that allows businesses to accept payments via:
- Credit/Debit Cards (Visa, Mastercard)
- Instant EFT (FNB, Absa, Nedbank, Standard Bank)
- Bitcoin
- MasterPass

## Prerequisites

1. **PayFast Merchant Account**: Sign up at [payfast.co.za](https://payfast.co.za)
2. **Business Verification**: Complete PayFast merchant verification

## Setup Steps

### 1. Get Merchant Credentials

1. Log in to PayFast dashboard
2. Go to **Settings** → **Integration**
3. Copy your:
   - Merchant ID
   - Merchant Key
   - Passphrase (set this yourself for security)

### 2. Configure Environment

Add credentials to `.env.local`:

```bash
VITE_PAYFAST_MERCHANT_ID=your_merchant_id
VITE_PAYFAST_MERCHANT_KEY=your_merchant_key
VITE_PAYFAST_PASSPHRASE=your_passphrase
VITE_PAYFAST_SANDBOX=true  # true for testing, false for production
```

### 3. Configure Return URLs

In the PayFast dashboard, set your return URLs:
- **Return URL**: `http://localhost:3000/payment/success`
- **Cancel URL**: `http://localhost:3000/payment/cancel`
- **Notify URL**: `http://localhost:3001/api/payment/notify`

## Testing

### Sandbox Mode

The system defaults to sandbox (test) mode. Use these test credentials:

| Card Number | Expiry | CVV |
|-------------|--------|-----|
| 4000 0000 0000 0002 | Any future date | Any 3 digits |

### Test Payment Flow

1. Create an invoice in the system
2. Click "Pay Now" button
3. You'll be redirected to PayFast sandbox
4. Use test card: `4000 0000 0000 0002`
5. Complete the payment
6. You'll be redirected back to the system

## Payment Integration

### Creating a Payment

The system automatically creates payment URLs when:
- An invoice is generated
- Customer clicks "Pay Now"

### Payment Notification (ITN)

PayFast sends Instant Transaction Notifications (ITN) to your server. The email server handles this at `/api/payment/notify`:

```javascript
// Example ITN data received
{
  m_payment_id: 'INV-2024-0001',
  pf_payment_id: '12345',
  payment_status: 'COMPLETE',
  amount_gross: 1000.00,
  amount_fee: -10.00,
  amount_net: 990.00
}
```

## Production Checklist

Before going live:

- [ ] Set `VITE_PAYFAST_SANDBOX=false`
- [ ] Verify merchant account is fully approved
- [ ] Update return URLs to production domain
- [ ] Test with real cards (small amounts)
- [ ] Enable domain authentication in PayFast

## Troubleshooting

### Payments Not Working

1. **Check Merchant ID/Key**: Ensure credentials are correct
2. **Verify Passphrase**: Must match PayFast dashboard exactly
3. **Sandbox Mode**: Ensure `VITE_PAYFAST_SANDBOX` is correct

### ITN Not Received

1. Check Notify URL is publicly accessible
2. Verify firewall allows PayFast IPs
3. Check server logs for incoming notifications

### Payment Stuck on Pending

1. Manually check PayFast dashboard
2. Verify ITN was sent/processed
3. Check invoice status in system

## Fees

PayFast charges:
- **Credit Cards**: 2.9% + R2.30 per transaction
- **Instant EFT**: 2.5% + R2.30 per transaction
- **Bitcoin**: 3% per transaction

## Security

- Never expose Merchant Key in client-side code
- Always verify ITN with PayFast validation
- Use HTTPS in production
- Keep passphrase secure
