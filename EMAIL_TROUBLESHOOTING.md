# 🔍 Email Troubleshooting Guide

## Problem: User doesn't receive email when order is approved

After approving an order, check the Vercel logs to see what's happening.

---

## Step 1: Check Vercel Logs

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your backend project** (the one with server code)
3. **Click "Deployments"** tab
4. **Click on the latest deployment**
5. **Click "Logs"** tab
6. **Look for email-related logs** after approving an order

### What to Look For:

#### ✅ Good Signs:
```
📧 [Email] Environment check:
📧 [Email] RESEND_API_KEY: Set (re_QZmA3Xw...)
📧 [Email] Attempting to send approved email to user@example.com
📧 [Email] Email data prepared: {...}
📧 [Email] Sending approved email via Resend...
✅ [Email] Order approved email sent successfully!
```

#### ❌ Problem Signs:

**1. API Key Not Set:**
```
📧 [Email] RESEND_API_KEY: NOT SET
❌ [Email] Resend API key not configured. Check RESEND_API_KEY environment variable.
```
**Fix:** Add `RESEND_API_KEY` in Vercel environment variables

**2. Email Skipped:**
```
⚠️ [Email] Skipping email send - Status: approved, User: exists, Email: none
```
**Fix:** User doesn't have an email address in the database

**3. Email Send Failed:**
```
❌ [Email] Failed to send order approved email
❌ [Email] Error message: Invalid API key
```
**Fix:** Check if API key is correct in Vercel

**4. Domain Not Verified:**
```
❌ [Email] Error message: Domain not verified
```
**Fix:** Verify your domain in Resend dashboard

---

## Step 2: Verify Environment Variables

1. **Go to Vercel** → Your backend project → **Settings** → **Environment Variables**
2. **Check these variables exist:**

| Variable | Should Be |
|----------|-----------|
| `RESEND_API_KEY` | `re_QZmA3Xwc_DSTvxbbuzXdtEd1PBJWDnifD` |
| `FROM_EMAIL` | `noreply@tconnect.store` (or your verified email) |
| `FROM_NAME` | `TConnect Store` |
| `BASE_URL` | `https://tconnect-store-v2.vercel.app` |

3. **Make sure all environments are checked:**
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development

4. **If missing, add them and redeploy!**

---

## Step 3: Check Resend Dashboard

1. **Go to Resend**: https://resend.com/emails
2. **Check if emails are being sent:**
   - Look for recent email attempts
   - Check status (sent, failed, pending)
   - See error messages if failed

3. **Check API Keys**: https://resend.com/api-keys
   - Make sure your API key is active
   - Regenerate if needed

4. **Check Domain Verification**: https://resend.com/domains
   - If using `noreply@tconnect.store`, domain must be verified
   - Or use a verified email address

---

## Step 4: Test Email Manually

### Option A: Use Resend Test Mode

1. **Get test API key** from Resend (starts with `re_test_`)
2. **Update `RESEND_API_KEY`** in Vercel to test key
3. **Redeploy**
4. **Approve an order**
5. **Check Resend dashboard** - email will be logged but not sent

### Option B: Use Verified Email

1. **In Resend**, verify your email address
2. **Update `FROM_EMAIL`** to your verified email (e.g., `yourname@gmail.com`)
3. **Redeploy**
4. **Test again**

---

## Common Issues & Fixes

### Issue 1: "Resend API key not configured"
**Cause:** `RESEND_API_KEY` not set in Vercel  
**Fix:** Add the environment variable and redeploy

### Issue 2: "Domain not verified"
**Cause:** Using `noreply@tconnect.store` but domain not verified  
**Fix:** 
- Verify domain in Resend, OR
- Use a verified email address (like Gmail)

### Issue 3: "Invalid API key"
**Cause:** API key is wrong or expired  
**Fix:** 
- Check API key in Resend dashboard
- Regenerate if needed
- Update in Vercel

### Issue 4: "User has no email"
**Cause:** User account doesn't have email address  
**Fix:** Make sure users register with email

### Issue 5: "Rate limit exceeded"
**Cause:** Hit Resend free tier limit (100 emails/day)  
**Fix:** Wait 24 hours or upgrade Resend plan

---

## Quick Checklist

- [ ] `RESEND_API_KEY` is set in Vercel
- [ ] `FROM_EMAIL` is set and verified in Resend
- [ ] All environment variables are set for Production/Preview/Development
- [ ] Backend has been redeployed after adding variables
- [ ] User has an email address in database
- [ ] Checked Vercel logs for errors
- [ ] Checked Resend dashboard for email attempts

---

## Still Not Working?

1. **Check Vercel logs** - Look for `📧 [Email]` messages
2. **Check Resend dashboard** - See if emails are attempted
3. **Try test API key** - Use Resend test mode to verify setup
4. **Check spam folder** - Emails might be going to spam
5. **Verify email address** - Make sure user's email is valid

---

## Next Steps

After fixing the issue:
1. **Redeploy backend** (if you changed environment variables)
2. **Approve a test order**
3. **Check Vercel logs** for success message
4. **Check user's email** (and spam folder)

The detailed logging will show exactly what's happening! 🔍

