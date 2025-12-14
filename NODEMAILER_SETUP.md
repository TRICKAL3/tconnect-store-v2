# 📧 Nodemailer SMTP Email Setup

## Overview
The email system now uses **Nodemailer** with SMTP, which works with:
- ✅ Gmail
- ✅ Outlook/Hotmail
- ✅ Yahoo Mail
- ✅ Custom SMTP servers
- ✅ Any email provider with SMTP support

---

## 🚀 Quick Setup

### Option 1: Gmail (Easiest)

1. **Enable 2-Step Verification** on your Gmail account
2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "TConnect Store"
   - Copy the 16-character password

3. **Add to Vercel Environment Variables:**
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_SECURE` = `false`
   - `SMTP_USER` = `your-email@gmail.com`
   - `SMTP_PASS` = `your-16-char-app-password`
   - `FROM_EMAIL` = `your-email@gmail.com`
   - `FROM_NAME` = `TConnect Store`
   - `BASE_URL` = `https://tconnect-store-v2.vercel.app`

---

### Option 2: Outlook/Hotmail

1. **Add to Vercel Environment Variables:**
   - `SMTP_HOST` = `smtp-mail.outlook.com`
   - `SMTP_PORT` = `587`
   - `SMTP_SECURE` = `false`
   - `SMTP_USER` = `your-email@outlook.com`
   - `SMTP_PASS` = `your-outlook-password`
   - `FROM_EMAIL` = `your-email@outlook.com`
   - `FROM_NAME` = `TConnect Store`
   - `BASE_URL` = `https://tconnect-store-v2.vercel.app`

---

### Option 3: Custom SMTP

1. **Get SMTP settings** from your email provider
2. **Add to Vercel Environment Variables:**
   - `SMTP_HOST` = `smtp.yourprovider.com`
   - `SMTP_PORT` = `587` (or `465` for SSL)
   - `SMTP_SECURE` = `false` (or `true` for port 465)
   - `SMTP_USER` = `your-email@yourdomain.com`
   - `SMTP_PASS` = `your-smtp-password`
   - `FROM_EMAIL` = `your-email@yourdomain.com`
   - `FROM_NAME` = `TConnect Store`
   - `BASE_URL` = `https://tconnect-store-v2.vercel.app`

---

## 📝 Step-by-Step: Add to Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your backend project**
3. **Settings** → **Environment Variables**
4. **Add each variable** (click "Add New" for each):

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_SECURE` | `false` | `true` for SSL (port 465), `false` for TLS (port 587) |
| `SMTP_USER` | `your-email@gmail.com` | Your email address |
| `SMTP_PASS` | `your-password` | Your email password or app password |
| `FROM_EMAIL` | `your-email@gmail.com` | Sender email address |
| `FROM_NAME` | `TConnect Store` | Display name for emails |
| `BASE_URL` | `https://tconnect-store-v2.vercel.app` | Your frontend URL |

5. **Check all environments**: ☑️ Production ☑️ Preview ☑️ Development
6. **Click "Save"**
7. **Redeploy** (Deployments → Three dots → Redeploy)

---

## ✅ Test Email Setup

### Method 1: Use Test Endpoint

1. **In browser console** (F12), run:

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

### Method 2: Check Status

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
  "smtpConfigured": true,
  "smtpHost": "smtp.gmail.com",
  "smtpUser": "your-email@gmail.com",
  "smtpPort": "587",
  "smtpSecure": "false",
  "fromEmail": "your-email@gmail.com",
  "fromName": "TConnect Store"
}
```

---

## 🔧 Common SMTP Settings

### Gmail
- **Host:** `smtp.gmail.com`
- **Port:** `587` (TLS) or `465` (SSL)
- **Secure:** `false` (TLS) or `true` (SSL)
- **Auth:** Use App Password (not regular password)

### Outlook/Hotmail
- **Host:** `smtp-mail.outlook.com`
- **Port:** `587`
- **Secure:** `false`

### Yahoo
- **Host:** `smtp.mail.yahoo.com`
- **Port:** `587` or `465`
- **Secure:** `false` (587) or `true` (465)

### Custom Domain (cPanel, etc.)
- **Host:** `mail.yourdomain.com` or `smtp.yourdomain.com`
- **Port:** `587` or `465`
- **Secure:** Check with your hosting provider

---

## 🐛 Troubleshooting

### "SMTP not configured"
**Problem:** Environment variables not set  
**Fix:** Add all SMTP variables in Vercel and redeploy

### "Invalid login"
**Problem:** Wrong username/password  
**Fix:** 
- For Gmail: Use App Password, not regular password
- Check username is full email address
- Verify password is correct

### "Connection timeout"
**Problem:** Wrong SMTP host or port  
**Fix:** 
- Verify SMTP host is correct
- Try port 465 with `SMTP_SECURE=true`
- Check firewall/network settings

### "Authentication failed"
**Problem:** Email provider blocking login  
**Fix:**
- Enable "Less secure app access" (if available)
- Use App Password (Gmail)
- Check if 2FA is enabled and use App Password

---

## 📊 Gmail App Password Setup (Detailed)

1. **Go to Google Account**: https://myaccount.google.com
2. **Security** → **2-Step Verification** (enable if not already)
3. **App Passwords**: https://myaccount.google.com/apppasswords
4. **Select app:** Mail
5. **Select device:** Other (Custom name)
6. **Enter:** "TConnect Store"
7. **Click Generate**
8. **Copy the 16-character password** (no spaces)
9. **Use this as `SMTP_PASS`** in Vercel

---

## ✅ After Setup

1. **Redeploy backend** (if you changed environment variables)
2. **Approve a test order**
3. **Check user's email** (and spam folder)
4. **Check Vercel logs** for email status

---

## 🔒 Security Notes

- **Never commit** SMTP passwords to Git
- **Use App Passwords** instead of main passwords when possible
- **Rotate passwords** periodically
- **Monitor** email sending for suspicious activity

---

## 💡 Tips

- **Gmail free tier:** 500 emails/day
- **Outlook free tier:** 300 emails/day
- **For production:** Consider a dedicated email service (SendGrid, Mailgun, etc.)
- **Test first:** Always test with the test endpoint before going live

---

## ✅ Setup Complete!

Once configured, emails will automatically send when:
- ✅ Order is approved
- ❌ Order is rejected
- 🎉 Order is fulfilled

No additional code changes needed! 🚀

