# 🚀 Deploy Backend to Vercel (Simplest Option!)

Since you're already using Vercel for the frontend, you can deploy the backend there too!

## ⚡ Quick Steps (5 Minutes)

### Step 1: Create Backend Project in Vercel

1. Go to **https://vercel.com/dashboard**
2. Click **"Add New Project"**
3. **Import the same repository** (tconnect v2.0)
4. **Configure:**
   - **Project Name**: `tconnect-backend`
   - **Root Directory**: `backend` ⚠️ **IMPORTANT!**
   - **Framework**: Leave as "Other" or auto-detect
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: Leave empty

### Step 2: Add Environment Variables

Click **"Environment Variables"** and add:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=YourSecurePassword123!
JWT_SECRET=(generate at https://randomkeygen.com/)
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
VERCEL=1
```

**Generate JWT_SECRET:**
- Visit: https://randomkeygen.com/
- Copy a "CodeIgniter Encryption Keys" (256-bit)
- Paste as `JWT_SECRET` value

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes
3. Copy your backend URL (e.g., `https://tconnect-backend.vercel.app`)

### Step 4: Test

Visit: `https://your-backend-url.vercel.app/health`
Should see: `{"status":"ok"}`

### Step 5: Update Frontend

1. Go to your **frontend project** in Vercel
2. **Settings** → **Environment Variables**
3. Add: `REACT_APP_API_BASE` = `https://your-backend-url.vercel.app`
4. **Redeploy** frontend

## ✅ Done!

Both frontend and backend are now on Vercel!

## ⚠️ Important: Database Persistence

**SQLite on Vercel:**
- The database file resets on each deployment
- Data won't persist between deployments
- **For production**, consider:
  - Using Supabase PostgreSQL (free tier available)
  - Or Railway/Render for persistent SQLite

**To use Supabase PostgreSQL:**
1. Create a Supabase project
2. Get the connection string
3. Update `backend/prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
4. Update `DATABASE_URL` to your Supabase connection string
5. Run `npx prisma migrate dev` locally, then push to production

## 🎯 Benefits of Vercel

- ✅ Same platform as frontend
- ✅ Automatic deployments from Git
- ✅ Free tier available
- ✅ Fast global CDN
- ✅ Easy to manage

## 📝 Full Guide

See `backend/DEPLOY_VERCEL.md` for detailed instructions and troubleshooting.

