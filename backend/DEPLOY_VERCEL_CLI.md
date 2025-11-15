# 🚀 Deploy Backend to Vercel via CLI

Deploy your backend directly from the command line!

## Quick Deploy Commands

### Step 1: Navigate to Backend Directory

```powershell
cd backend
```

### Step 2: Deploy to Vercel

```powershell
npx vercel
```

**First time?** It will ask:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No** (for first deployment)
- Project name? **tconnect-backend** (or any name)
- Directory? **./** (current directory)
- Override settings? **No**

### Step 3: Set Environment Variables

After first deployment, set environment variables:

```powershell
npx vercel env add DATABASE_URL production
# Enter: file:./prisma/dev.db

npx vercel env add ADMIN_PASS production
# Enter: YourSecurePassword123!

npx vercel env add JWT_SECRET production
# Enter: (generate at https://randomkeygen.com/)

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

### Step 5: Get Your Backend URL

After deployment, Vercel will show:
```
✅ Production: https://tconnect-backend.vercel.app
```

**Copy this URL!**

### Step 6: Update Frontend

Go to your frontend Vercel project and add:
- `REACT_APP_API_BASE` = `https://tconnect-backend.vercel.app`

## All-in-One Script

You can also set all variables at once using a `.env` file, then:

```powershell
cd backend
npx vercel --prod
```

Then add environment variables via Vercel dashboard or CLI.

## ✅ Done!

Your backend is now live on Vercel!

