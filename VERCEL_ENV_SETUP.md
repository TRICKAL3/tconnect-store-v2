# 🚀 Quick Setup: Add Resend API Key to Vercel

## Your API Key
```
re_QZmA3Xwc_DSTvxbbuzXdtEd1PBJWDnifD
```

---

## Step-by-Step Instructions

### 1. Go to Vercel Dashboard
- Visit: https://vercel.com/dashboard
- Sign in if needed

### 2. Select Your Project
- Find your **backend/server project** (the one that handles API routes)
- Click on it to open

### 3. Go to Environment Variables
- Click **"Settings"** tab (top navigation)
- Click **"Environment Variables"** (left sidebar)

### 4. Add These 4 Variables

Click **"Add New"** for each variable:

#### Variable 1: RESEND_API_KEY
- **Key:** `RESEND_API_KEY`
- **Value:** `re_QZmA3Xwc_DSTvxbbuzXdtEd1PBJWDnifD`
- **Environments:** ☑️ Production ☑️ Preview ☑️ Development
- Click **"Save"**

#### Variable 2: FROM_EMAIL
- **Key:** `FROM_EMAIL`
- **Value:** `noreply@tconnect.store` (or your verified email)
- **Environments:** ☑️ Production ☑️ Preview ☑️ Development
- Click **"Save"**

#### Variable 3: FROM_NAME
- **Key:** `FROM_NAME`
- **Value:** `TConnect Store`
- **Environments:** ☑️ Production ☑️ Preview ☑️ Development
- Click **"Save"**

#### Variable 4: BASE_URL
- **Key:** `BASE_URL`
- **Value:** `https://tconnect-store-v2.vercel.app` (your frontend URL)
- **Environments:** ☑️ Production ☑️ Preview ☑️ Development
- Click **"Save"**

---

## 5. Redeploy (CRITICAL!)

**⚠️ Environment variables only work after redeployment!**

1. Go to **"Deployments"** tab
2. Find the **latest deployment**
3. Click the **three dots (⋯)** on the right
4. Click **"Redeploy"**
5. Wait 2-3 minutes for deployment to finish

---

## ✅ Verify It's Working

After redeployment:

1. **Create a test order** in admin panel
2. **Approve the order**
3. **Check the user's email** - they should receive an email!

---

## 🔍 Troubleshooting

### If emails don't send:

1. **Check Vercel logs:**
   - Go to your project → **"Deployments"** → Click latest deployment
   - Check **"Logs"** tab
   - Look for email-related errors

2. **Verify environment variables:**
   - Go back to **Settings** → **Environment Variables**
   - Make sure all 4 variables are there
   - Make sure all environments are checked

3. **Check Resend dashboard:**
   - Go to: https://resend.com/emails
   - See if emails are being sent (even if they fail)

---

## 📝 Summary

You need to add these 4 environment variables in Vercel:

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | `re_QZmA3Xwc_DSTvxbbuzXdtEd1PBJWDnifD` |
| `FROM_EMAIL` | `noreply@tconnect.store` |
| `FROM_NAME` | `TConnect Store` |
| `BASE_URL` | `https://tconnect-store-v2.vercel.app` |

**Don't forget to redeploy after adding them!** 🚀

