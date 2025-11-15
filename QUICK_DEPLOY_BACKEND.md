# ⚡ Quick Backend Deployment (5 Minutes)

## 🎯 Recommended: Railway (Easiest)

### Step 1: Sign Up
1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign in with **GitHub**

### Step 2: Deploy
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your repository
3. Railway will auto-detect it

### Step 3: Configure
1. Click on your project → **Settings**
2. Set **Root Directory** to: `backend`
3. Go to **Variables** tab
4. Add these variables:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=YourSecurePassword123!
JWT_SECRET=generate-a-random-256-bit-key-here
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
```

**Generate JWT_SECRET:**
- Go to: https://randomkeygen.com/
- Copy a "CodeIgniter Encryption Keys" (256-bit)
- Paste it as `JWT_SECRET` value

### Step 4: Get Your URL
1. Wait for deployment (2-3 minutes)
2. Go to **Settings** → **Domains**
3. Copy the URL (e.g., `https://tconnect-backend-production.up.railway.app`)

### Step 5: Test
1. Open: `https://your-url.railway.app/health`
2. Should see: `{"status":"ok"}`

### Step 6: Update Frontend
1. Go to **Vercel** → Your Project → **Settings** → **Environment Variables**
2. Add: `REACT_APP_API_BASE` = `https://your-url.railway.app`
3. **Redeploy** frontend

## ✅ Done!

Your backend is now live and accessible from anywhere!

## 📝 What You'll Get

- ✅ Backend URL: `https://your-app.up.railway.app`
- ✅ All API endpoints working
- ✅ Database automatically created
- ✅ Automatic deployments on git push

## 🔍 Verify It's Working

1. Test health endpoint: `https://your-url.railway.app/health`
2. Test products: `https://your-url.railway.app/products`
3. Check Vercel console - should see API calls to your Railway URL (not localhost)

## 🆘 Need More Details?

See the full guides:
- `backend/DEPLOY_RAILWAY.md` - Detailed Railway guide
- `backend/DEPLOY_RENDER.md` - Render alternative
- `BACKEND_DEPLOYMENT.md` - Complete overview

