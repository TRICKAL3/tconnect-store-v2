# 🔧 Environment Variables Setup Guide

## Problem
If the app works on your local machine but not on other devices/browsers, it's likely because:
1. **Backend API URL is not configured** - The app is trying to connect to `localhost:4000` which only works on your machine
2. **Environment variables not set in Vercel** - Production builds need the correct API URL

## ✅ Solution: Set Environment Variables in Vercel

### Step 1: Get Your Backend URL

Your backend should be deployed on:
- **Railway**: `https://your-app-name.railway.app`
- **Render**: `https://your-app-name.onrender.com`
- **Heroku**: `https://your-app-name.herokuapp.com`
- **Or any other hosting service**

**If your backend is NOT deployed yet**, you need to deploy it first!

### Step 2: Add Environment Variables in Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Click on your project: **tconnect-v2-0**

2. **Go to Settings:**
   - Click **Settings** tab
   - Click **Environment Variables** in the left menu

3. **Add the API Base URL:**
   - Click **Add New**
   - **Name**: `REACT_APP_API_BASE`
   - **Value**: Your backend URL (e.g., `https://your-backend.railway.app`)
   - **Environment**: Select **Production**, **Preview**, and **Development** (or just **Production** if you only want it for production)
   - Click **Save**

4. **Verify Other Environment Variables:**
   Make sure these are also set:
   - `REACT_APP_FIREBASE_API_KEY`
   - `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `REACT_APP_FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_STORAGE_BUCKET`
   - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
   - `REACT_APP_FIREBASE_APP_ID`
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

### Step 3: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

### Step 4: Verify

1. Visit your Vercel URL
2. Open browser console (F12)
3. Look for logs like:
   - `📤 [Home] Fetching products from: https://your-backend.railway.app/products`
   - `📊 [Rates] Fetching rates from: https://your-backend.railway.app/rates`
   - `📤 [OrderHistory] Fetching orders for: ...`

If you see `http://localhost:4000` in the logs, the environment variable is not set correctly!

## 🔍 Troubleshooting

### Issue: Still seeing `localhost:4000` in console logs

**Solution:**
1. Double-check the environment variable name: `REACT_APP_API_BASE` (must start with `REACT_APP_`)
2. Make sure it's set for **Production** environment
3. **Redeploy** after adding the variable
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: CORS errors in console

**Solution:**
The backend CORS is configured to allow all origins. If you still see CORS errors:
1. Check that your backend is actually running
2. Verify the backend URL is correct
3. Check backend logs for errors

### Issue: "Failed to fetch" errors

**Solution:**
1. Verify your backend URL is accessible (try opening it in a browser)
2. Check that your backend is deployed and running
3. Verify the environment variable is set correctly in Vercel
4. Check backend logs for any errors

## 📝 Quick Checklist

- [ ] Backend is deployed and accessible
- [ ] `REACT_APP_API_BASE` is set in Vercel environment variables
- [ ] Environment variable is set for **Production** environment
- [ ] Project has been **redeployed** after adding variables
- [ ] Browser console shows correct API URL (not localhost)
- [ ] No CORS errors in console
- [ ] Products load correctly
- [ ] Order history loads correctly
- [ ] Rates update correctly

## 🚀 Example Environment Variables

```
REACT_APP_API_BASE=https://tconnect-backend.railway.app
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=tconnect-store-9893e.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tconnect-store-9893e
REACT_APP_FIREBASE_STORAGE_BUCKET=tconnect-store-9893e.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=708789106974
REACT_APP_FIREBASE_APP_ID=1:708789106974:web:...
REACT_APP_SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
```

**Important:** Replace `https://tconnect-backend.railway.app` with your actual backend URL!

