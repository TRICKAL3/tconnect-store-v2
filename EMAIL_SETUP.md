# 📧 Email Notification System Setup

## Overview
The email notification system automatically sends emails to users when:
- ✅ Order is **approved** by admin
- ❌ Order is **rejected** by admin
- 🎉 Order is **fulfilled** (delivered) by admin

Each email includes:
- Order summary with all items
- Gift card codes (if applicable)
- Link to order history page

---

## 🚀 Setup Instructions

### Step 1: Get Resend API Key

1. **Sign up for Resend** (if you don't have an account):
   - Go to: https://resend.com
   - Click "Sign Up" and create a free account
   - Free tier includes: 3,000 emails/month, 100 emails/day

2. **Create an API Key**:
   - After signing in, go to: https://resend.com/api-keys
   - Click "Create API Key"
   - Give it a name (e.g., "TConnect Store Production")
   - **Copy the API key** (you'll only see it once!)

3. **Verify your domain** (optional but recommended):
   - Go to: https://resend.com/domains
   - Add your domain (e.g., `tconnect.store`)
   - Follow DNS verification steps
   - Once verified, you can use `noreply@tconnect.store` as the sender

---

### Step 2: Set Environment Variables

#### For Vercel Deployment:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project** (the one with the backend/server code)
3. **Go to Settings** → **Environment Variables**
4. **Add the following variables**:

   | Key | Value | Description |
   |-----|-------|-------------|
   | `RESEND_API_KEY` | `re_xxxxxxxxxxxxx` | Your Resend API key from Step 1 |
   | `FROM_EMAIL` | `noreply@tconnect.store` | Sender email (must be verified domain) |
   | `FROM_NAME` | `TConnect Store` | Display name for emails |
   | `BASE_URL` | `https://tconnect-store-v2.vercel.app` | Your frontend URL (for order history links) |

5. **Make sure all environments are checked**:
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development

6. **Click "Save"**

#### For Local Development:

Create a `.env` file in the `server/` directory:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=noreply@tconnect.store
FROM_NAME=TConnect Store
BASE_URL=http://localhost:3000
```

**Note:** For local testing, you can use Resend's test mode or a verified email address.

---

### Step 3: Redeploy

**⚠️ IMPORTANT:** Environment variables only take effect after redeployment!

1. **In Vercel**, go to **Deployments** tab
2. **Click the three dots (⋯)** on the latest deployment
3. **Click "Redeploy"**
4. **Wait 2-3 minutes** for deployment to finish

---

## ✅ Testing

### Test 1: Check Email Service Initialization

1. **Check server logs** after deployment
2. **Look for**: No errors about Resend initialization
3. **If you see**: `⚠️ Resend API key not configured` → Check your environment variables

### Test 2: Test Order Approval Email

1. **Create a test order** in the admin panel
2. **Approve the order**
3. **Check the user's email inbox**
4. **Verify**:
   - Email is received
   - Order details are correct
   - Link to order history works
   - Gift card codes are shown (if applicable)

### Test 3: Test Order Rejection Email

1. **Reject a test order**
2. **Check email inbox**
3. **Verify** rejection email is received

### Test 4: Test Order Fulfillment Email

1. **Fulfill an approved order** (add gift card codes if needed)
2. **Check email inbox**
3. **Verify** fulfillment email is received with all codes

---

## 🔧 Troubleshooting

### Emails Not Sending?

1. **Check Resend API Key**:
   - Go to Resend dashboard → API Keys
   - Make sure the key is active
   - Regenerate if needed

2. **Check Environment Variables**:
   - Verify all variables are set in Vercel
   - Make sure they're set for the correct environment (Production/Preview/Development)
   - Redeploy after adding/changing variables

3. **Check Server Logs**:
   - Look for email-related errors in Vercel logs
   - Common errors:
     - `Invalid API key` → Check `RESEND_API_KEY`
     - `Invalid sender email` → Verify domain in Resend
     - `Rate limit exceeded` → You've hit the free tier limit (100/day)

4. **Check Spam Folder**:
   - Emails might go to spam initially
   - Mark as "Not Spam" to improve deliverability

### Using Test Mode

If you want to test without sending real emails:

1. **Use Resend's test API key** (starts with `re_test_`)
2. **Emails will be logged** in Resend dashboard but not actually sent
3. **Perfect for development/testing**

---

## 📝 Email Templates

The email templates are located in:
- **File**: `server/lib/email.ts`
- **Functions**:
  - `sendOrderApprovedEmail()` - Green theme, "Order Approved!"
  - `sendOrderRejectedEmail()` - Red theme, "Order Rejected"
  - `sendOrderFulfilledEmail()` - Green theme, "Order Delivered! 🎉"

### Customizing Templates

To customize email templates:

1. **Edit** `server/lib/email.ts`
2. **Modify the HTML** in the respective function
3. **Redeploy** to apply changes

---

## 🔒 Security Notes

- **Never commit** `.env` files or API keys to Git
- **Use environment variables** for all sensitive data
- **Rotate API keys** periodically
- **Monitor** Resend dashboard for suspicious activity

---

## 📊 Monitoring

### Resend Dashboard

1. **Go to**: https://resend.com/emails
2. **View**:
   - Email delivery status
   - Open rates (if tracking enabled)
   - Bounce/complaint rates
   - API usage

### Server Logs

Check Vercel logs for:
- `✅ Order approved email sent to...` - Success
- `❌ Failed to send order approved email` - Error
- `⚠️ Resend API key not configured` - Missing config

---

## 💰 Pricing

**Resend Free Tier:**
- 3,000 emails/month
- 100 emails/day
- Perfect for small to medium stores

**If you need more:**
- Upgrade to paid plan: https://resend.com/pricing
- Starts at $20/month for 50,000 emails

---

## ✅ Setup Complete!

Once configured, emails will automatically send when:
- Admin approves an order
- Admin rejects an order
- Admin fulfills an order

No additional code changes needed! 🎉

