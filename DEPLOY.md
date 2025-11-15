# 🚀 Quick Deployment to Vercel

## Frontend Deployment (Vercel)

### Method 1: Via Vercel Dashboard (Easiest)

1. **Go to https://vercel.com** and sign in
2. Click **"Add New Project"**
3. **Import your repository** or upload your project
4. Vercel will auto-detect Create React App
5. **Add Environment Variables** before deploying:

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

6. Click **"Deploy"** - Done! ✅

### Method 2: Via CLI

```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Backend Deployment (Railway - Recommended)

1. Go to **https://railway.app** → Sign in with GitHub
2. **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. **Settings** → **Root Directory** → Set to `backend`
5. **Variables** tab → Add:
   - `DATABASE_URL` (if using external DB, or use Railway's PostgreSQL)
   - `JWT_SECRET` (any random string)
   - `ADMIN_PASSWORD` (your admin password)
   - `SUPABASE_URL` and `SUPABASE_KEY`
6. Railway auto-deploys and gives you a URL
7. **Update frontend**: In Vercel, update `REACT_APP_API_BASE` to your Railway URL

## After Deployment

1. **Firebase Console** → Authentication → Settings → Add your Vercel domain
2. **Google Cloud Console** → OAuth → Add redirect URI: `https://your-app.vercel.app`

That's it! Your app is live! 🎉

