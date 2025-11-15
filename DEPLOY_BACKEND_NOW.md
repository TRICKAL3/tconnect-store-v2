# ⚡ Deploy Backend to Vercel - Command Line

## 🚀 Quick Commands (Run These)

### Step 1: Navigate to Backend

```powershell
cd backend
```

### Step 2: Deploy to Vercel

```powershell
npx vercel --yes
```

This will:
- Create a new project (or link to existing)
- Deploy your backend
- Give you a URL

### Step 3: Set Environment Variables

After deployment, you'll need to add environment variables. You can do this via:

**Option A: Vercel Dashboard (Easier)**
1. Go to https://vercel.com/dashboard
2. Find your `tconnect-backend` project
3. Settings → Environment Variables
4. Add all the variables (see below)

**Option B: Command Line**
```powershell
npx vercel env add DATABASE_URL production
# When prompted, enter: file:./prisma/dev.db

npx vercel env add ADMIN_PASS production
# Enter your admin password

npx vercel env add JWT_SECRET production
# Enter a random 256-bit key (generate at https://randomkeygen.com/)

npx vercel env add SUPABASE_URL production
# Enter: https://cifqhaamcfqahrpurxpl.supabase.co

npx vercel env add SUPABASE_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ

npx vercel env add VERCEL production
# Enter: 1
```

### Step 4: Deploy to Production

```powershell
npx vercel --prod
```

### Step 5: Copy Your Backend URL

After deployment, you'll see:
```
✅ Production: https://tconnect-backend-xxxxx.vercel.app
```

**Copy this URL!**

### Step 6: Update Frontend

1. Go to your **frontend project** in Vercel dashboard
2. **Settings** → **Environment Variables**
3. Add: `REACT_APP_API_BASE` = `https://your-backend-url.vercel.app`
4. **Redeploy** frontend

## 📋 Environment Variables Needed

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=YourSecurePassword123!
JWT_SECRET=(generate at https://randomkeygen.com/)
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
VERCEL=1
```

## ✅ That's It!

Your backend will be live on Vercel!

