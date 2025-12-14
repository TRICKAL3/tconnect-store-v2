# 🧪 Test Email System

## Quick Test Steps

### Step 1: Check Email Configuration Status

1. **Open your browser console** (F12)
2. **Go to Admin panel** and make sure you're logged in
3. **Run this in console:**

```javascript
fetch('/api/email-test/status', {
  headers: {
    'X-Admin-Password': 'YOUR_ADMIN_PASSWORD'
  }
})
.then(r => r.json())
.then(console.log)
```

**Expected output:**
```json
{
  "resendConfigured": true,
  "fromEmail": "noreply@tconnect.store",
  "fromName": "TConnect Store",
  "baseUrl": "https://tconnect-store-v2.vercel.app",
  "apiKeyPreview": "re_QZmA3Xw..."
}
```

**If `resendConfigured` is `false`:** The API key is not set in Vercel!

---

### Step 2: Send Test Email

1. **In browser console, run:**

```javascript
fetch('/api/email-test/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Password': 'YOUR_ADMIN_PASSWORD'
  },
  body: JSON.stringify({
    testEmail: 'your-email@gmail.com'
  })
})
.then(r => r.json())
.then(console.log)
```

**If successful:**
```json
{
  "success": true,
  "message": "Test email sent successfully! Check your inbox and spam folder.",
  "sentTo": "your-email@gmail.com"
}
```

**If failed:**
```json
{
  "error": "Failed to send test email",
  "details": "...",
  "hint": "Check Vercel logs for detailed error information"
}
```

---

### Step 3: Check Vercel Logs

1. **Go to Vercel Dashboard** → Your backend project
2. **Deployments** → Latest deployment → **Logs**
3. **Look for:**
   - `📧 [Email] Environment check:` - Shows if API key is set
   - `📧 [Email] Attempting to send...` - Shows email attempt
   - `✅ [Email] Order approved email sent successfully!` - Success!
   - `❌ [Email] Failed to send...` - Error details

---

## Common Issues

### Issue 1: `resendConfigured: false`
**Problem:** API key not set in Vercel  
**Fix:**
1. Go to Vercel → Settings → Environment Variables
2. Add `RESEND_API_KEY` = `re_QZmA3Xwc_DSTvxbbuzXdtEd1PBJWDnifD`
3. Redeploy backend

### Issue 2: "Domain not verified"
**Problem:** Using `noreply@tconnect.store` but domain not verified  
**Fix:**
- Verify domain in Resend dashboard, OR
- Use a verified email (like Gmail) for `FROM_EMAIL`

### Issue 3: "Invalid API key"
**Problem:** API key is wrong  
**Fix:**
- Check API key in Resend dashboard
- Regenerate if needed
- Update in Vercel

---

## Test After Approving Order

1. **Approve an order** in admin panel
2. **Check Vercel logs** immediately
3. **Look for email logs** - should see:
   ```
   📧 [Email] Attempting to send approved email to user@example.com
   📧 [Email] Email data prepared: {...}
   📧 [Email] Sending approved email via Resend...
   ✅ [Email] Order approved email sent successfully!
   ```

4. **Check user's email** (and spam folder)

---

## Still Not Working?

1. **Check Vercel logs** - Look for `📧 [Email]` messages
2. **Check Resend dashboard** - https://resend.com/emails
3. **Verify environment variables** are set correctly
4. **Redeploy backend** after changing environment variables

The test endpoint will show you exactly what's wrong! 🔍

