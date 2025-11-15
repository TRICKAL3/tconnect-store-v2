# Vercel Deployment Guide

## Quick Start (5 Minutes)

### Step 1: Deploy Frontend to Vercel

1. **Go to https://vercel.com and sign in**
2. **Click "Add New Project"**
3. **Import your Git repository** (or drag & drop your project folder)
4. **Configure:**
   - Framework: **Create React App**
   - Root Directory: **./** (leave as is)
   - Build Command: **npm run build** (auto-detected)
   - Output Directory: **build** (auto-detected)

5. **Add Environment Variables** (Click "Environment Variables" button):
   
   ```
   REACT_APP_API_BASE=https://your-backend-url.railway.app
   REACT_APP_FIREBASE_API_KEY=AIzaSyAjR4FjfFoDPQVf6q09oWEPZN_Mto3Gg1Y
   REACT_APP_FIREBASE_AUTH_DOMAIN=tconnect-store-9893e.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=tconnect-store-9893e
   REACT_APP_FIREBASE_STORAGE_BUCKET=tconnect-store-9893e.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=708789106974
   REACT_APP_FIREBASE_APP_ID=1:708789106974:web:04ede5bded3a2f22bfb10f
   REACT_APP_SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
   ```

6. **Click "Deploy"** - Your site will be live in ~2 minutes! 🚀

### Step 2: Deploy Backend (Railway - Easiest Option)

**Option A: Railway (Recommended - Free tier available)**

1. Go to https://railway.app and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Click the three dots → "Settings" → "Root Directory" → Set to `backend`
5. Add Environment Variables:
   ```
   DATABASE_URL=file:./prisma/dev.db
   JWT_SECRET=your-secret-key-here
   ADMIN_PASSWORD=your-admin-password
   SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
   SUPABASE_KEY=your-supabase-service-key
   PORT=4000
   ```
6. Railway will auto-deploy and give you a URL like: `https://your-app.railway.app`
7. **Update frontend**: Go back to Vercel → Settings → Environment Variables → Update `REACT_APP_API_BASE` to your Railway URL

**Option B: Render (Free tier available)**

1. Go to https://render.com and sign in
2. Click "New" → "Web Service"
3. Connect your repository
4. Configure:
   - **Name**: tconnect-backend
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables (same as Railway)
6. Deploy and get your URL

### Step 3: Update Firebase & Google OAuth

After deployment, update these:

**Firebase Console:**
1. Go to Firebase → Authentication → Settings → Authorized domains
2. Add: `your-project.vercel.app`

**Google Cloud Console:**
1. Go to APIs & Services → Credentials → Your OAuth Client
2. Add authorized redirect URI: `https://your-project.vercel.app`

---

## Detailed Instructions

## Prerequisites
1. A Vercel account (sign up at https://vercel.com)
2. Your backend API deployed (see Backend Deployment section)
3. Environment variables ready

## Step 1: Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

## Step 2: Deploy Frontend to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New Project"

2. **Import Your Repository**
   - Connect your Git repository (GitHub, GitLab, or Bitbucket)
   - Select your repository: `tconnect v2.0`

3. **Configure Project Settings**
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (root of the project)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

4. **Add Environment Variables**
   Click "Environment Variables" and add:

   ```
   REACT_APP_API_BASE=https://your-backend-api.vercel.app
   REACT_APP_FIREBASE_API_KEY=AIzaSyAjR4FjfFoDPQVf6q09oWEPZN_Mto3Gg1Y
   REACT_APP_FIREBASE_AUTH_DOMAIN=tconnect-store-9893e.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=tconnect-store-9893e
   REACT_APP_FIREBASE_STORAGE_BUCKET=tconnect-store-9893e.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=708789106974
   REACT_APP_FIREBASE_APP_ID=1:708789106974:web:04ede5bded3a2f22bfb10f
   REACT_APP_SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
   ```

   **Important**: Replace `https://your-backend-api.vercel.app` with your actual backend URL after deploying it.

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your site will be live at `https://your-project.vercel.app`

### Option B: Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod
```

## Step 3: Deploy Backend to Vercel

The backend needs to be deployed separately. You have two options:

### Option A: Deploy Backend as Separate Vercel Project

1. **Create a new Vercel project for backend**
   - Root Directory: `./backend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

2. **Add Backend Environment Variables**
   ```
   DATABASE_URL=your-database-url
   JWT_SECRET=your-jwt-secret
   ADMIN_PASSWORD=your-admin-password
   SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
   SUPABASE_KEY=your-supabase-service-key
   ```

3. **Update Frontend API URL**
   - Go back to your frontend Vercel project
   - Update `REACT_APP_API_BASE` to your backend Vercel URL

### Option B: Deploy Backend to Railway/Render/Heroku

1. **Railway** (Recommended - Easy setup)
   - Visit https://railway.app
   - Connect your repository
   - Select `backend` folder
   - Add environment variables
   - Deploy

2. **Render**
   - Visit https://render.com
   - Create a new Web Service
   - Connect your repository
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. **Heroku**
   - Create a Heroku app
   - Set buildpack to Node.js
   - Deploy from `backend` directory

## Step 4: Update Firebase Authorized Domains

After deploying, add your Vercel domain to Firebase:

1. Go to Firebase Console → Authentication → Settings
2. Add your Vercel domain to "Authorized domains":
   - `your-project.vercel.app`
   - `your-custom-domain.com` (if you add one)

## Step 5: Update Google OAuth Redirect URIs

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://your-project.vercel.app`
   - `https://your-custom-domain.com` (if applicable)

## Step 6: Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Firebase and Google OAuth with the new domain

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure `npm run build` works locally first
- Check build logs in Vercel dashboard

### API Calls Fail
- Verify `REACT_APP_API_BASE` is set correctly
- Check CORS settings on your backend
- Ensure backend is deployed and accessible

### Firebase Auth Not Working
- Verify all Firebase environment variables are set
- Check authorized domains in Firebase Console
- Verify OAuth redirect URIs in Google Cloud Console

### Images Not Loading
- Check Supabase environment variables
- Verify Supabase bucket permissions
- Check CORS settings in Supabase

## Environment Variables Checklist

**Frontend (Vercel):**
- ✅ `REACT_APP_API_BASE`
- ✅ `REACT_APP_FIREBASE_API_KEY`
- ✅ `REACT_APP_FIREBASE_AUTH_DOMAIN`
- ✅ `REACT_APP_FIREBASE_PROJECT_ID`
- ✅ `REACT_APP_FIREBASE_STORAGE_BUCKET`
- ✅ `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `REACT_APP_FIREBASE_APP_ID`
- ✅ `REACT_APP_SUPABASE_URL`
- ✅ `REACT_APP_SUPABASE_ANON_KEY`

**Backend (Separate deployment):**
- ✅ `DATABASE_URL`
- ✅ `JWT_SECRET`
- ✅ `ADMIN_PASSWORD`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_KEY`

