# ⚡ Quick Backend Setup - All Commands

## ✅ Step 1: Backend is Already Deployed!

**Your Backend URL:** `https://backend-krm6docid-trickals-projects.vercel.app`

## 🔧 Step 2: Set Environment Variables

### Easy Way: Via Vercel Dashboard

1. Go to: https://vercel.com/trickals-projects/backend/settings/environment-variables
2. Click **"Add New"** for each variable:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:./prisma/dev.db` |
| `ADMIN_PASS` | `YourSecurePassword123!` |
| `JWT_SECRET` | Generate at https://randomkeygen.com/ (256-bit key) |
| `SUPABASE_URL` | `https://cifqhaamcfqahrpurxpl.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ` |
| `VERCEL` | `1` |

3. Set for **Production** environment
4. Click **Save** for each

### Command Line Way (From backend directory):

```powershell
cd backend

# Generate JWT_SECRET first at https://randomkeygen.com/
# Then run these (you'll be prompted to enter values):

npx vercel env add DATABASE_URL production
# Enter: file:./prisma/dev.db

npx vercel env add ADMIN_PASS production
# Enter: YourSecurePassword123!

npx vercel env add JWT_SECRET production
# Enter: (paste your generated key)

npx vercel env add SUPABASE_URL production
# Enter: https://cifqhaamcfqahrpurxpl.supabase.co

npx vercel env add SUPABASE_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ

npx vercel env add VERCEL production
# Enter: 1
```

## 🚀 Step 3: Redeploy Backend

```powershell
cd backend
npx vercel --prod
```

## 🔄 Step 4: Update Frontend

1. Go to: https://vercel.com/dashboard
2. Find your **frontend project** (tconnect-v2-0)
3. **Settings** → **Environment Variables**
4. Add/Update: `REACT_APP_API_BASE` = `https://backend-krm6docid-trickals-projects.vercel.app`
5. **Redeploy** frontend (or it will auto-deploy on next push)

## ✅ Step 5: Test

1. Visit: https://backend-krm6docid-trickals-projects.vercel.app/health
2. Should see: `{"status":"ok"}`
3. Visit your frontend site
4. Check browser console - should see API calls to your backend URL

## 🎯 All Done!

Your backend is live and connected to your frontend!

