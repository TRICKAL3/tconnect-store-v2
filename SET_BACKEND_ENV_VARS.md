# 🔧 Set Backend Environment Variables

Your backend is deployed! Now add environment variables.

## ✅ Your Backend URL

**Backend URL:** `https://backend-krm6docid-trickals-projects.vercel.app`

## 📝 Set Environment Variables

### Option 1: Via Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/trickals-projects/backend/settings/environment-variables
2. Add these variables one by one:

```
DATABASE_URL = file:./prisma/dev.db
ADMIN_PASS = YourSecurePassword123!
JWT_SECRET = (generate at https://randomkeygen.com/ - use 256-bit key)
SUPABASE_URL = https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
VERCEL = 1
```

3. Make sure to set them for **Production** environment
4. After adding, **redeploy** the backend

### Option 2: Via Command Line

From the `backend` directory:

```powershell
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

Then redeploy:
```powershell
npx vercel --prod
```

## 🔄 After Setting Variables

1. **Redeploy backend:**
   ```powershell
   cd backend
   npx vercel --prod
   ```

2. **Update frontend:**
   - Go to your frontend Vercel project
   - Settings → Environment Variables
   - Add: `REACT_APP_API_BASE` = `https://backend-krm6docid-trickals-projects.vercel.app`
   - Redeploy frontend

## ✅ Test

Visit: https://backend-krm6docid-trickals-projects.vercel.app/health
Should see: `{"status":"ok"}`

