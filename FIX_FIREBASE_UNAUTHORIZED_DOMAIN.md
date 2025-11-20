# 🔥 Fix Firebase Unauthorized Domain Error

## The Problem:
Firebase is blocking authentication because your Vercel domain is not in the authorized domains list.

## ✅ Quick Fix (5 Minutes):

### Step 1: Get Your Vercel Domain
1. Go to **Vercel Dashboard** → Your Project
2. Copy your domain (e.g., `tconnect-store-v2.vercel.app` or your custom domain)

### Step 2: Add Domain to Firebase

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select your project: **tconnect-store-9893e**

2. **Navigate to Authentication:**
   - Click **Authentication** in the left sidebar
   - Click **Settings** tab (gear icon)
   - Scroll down to **Authorized domains**

3. **Add Your Vercel Domain:**
   - Click **Add domain**
   - Enter your Vercel domain (e.g., `tconnect-store-v2.vercel.app`)
   - **IMPORTANT:** Also add your custom domain if you have one
   - Click **Add**

4. **Verify Domains:**
   Make sure these domains are in the list:
   - ✅ `localhost` (for development)
   - ✅ `tconnect-store-v2.vercel.app` (your Vercel domain)
   - ✅ Your custom domain (if you have one)
   - ✅ `tconnect-store-9893e.firebaseapp.com` (Firebase default)

### Step 3: Add to Google Cloud Console (For OAuth)

If you're using Google Sign-In, also add the redirect URI:

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select project: **tconnect-store-9893e**

2. **Navigate to OAuth Settings:**
   - Go to **APIs & Services** → **Credentials**
   - Find your **OAuth 2.0 Client ID** (Web application)
   - Click **Edit**

3. **Add Authorized Redirect URIs:**
   - Add: `https://tconnect-store-v2.vercel.app` (your Vercel domain)
   - Add: `https://your-custom-domain.com` (if you have one)
   - Click **Save**

### Step 4: Test

1. **Clear browser cache** (or use incognito mode)
2. **Visit your Vercel site**
3. **Try signing in** - should work now!

## 🎯 Common Domains to Add:

- `localhost` (always needed for development)
- `tconnect-store-v2.vercel.app` (your Vercel preview domain)
- `tconnect-store-v2-*.vercel.app` (Vercel preview URLs)
- Your custom domain (if you have one)

## ⚠️ Important Notes:

1. **Changes take effect immediately** - no need to redeploy
2. **Add ALL domains** you might use (preview, production, custom)
3. **For OAuth**, you need to add redirect URIs in Google Cloud Console too

## 🔍 Verify It's Fixed:

After adding the domain:
1. Try signing in again
2. The error should be gone
3. Authentication should work normally

---

**If it still doesn't work:**
- Check browser console for the exact error
- Verify the domain is exactly as shown in the error message
- Make sure you're adding it to the correct Firebase project

