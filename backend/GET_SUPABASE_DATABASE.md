# 🔗 Get Supabase PostgreSQL Connection String

## Step 1: Go to Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Select your project (the one with URL: `cifqhaamcfqahrpurxpl.supabase.co`)

## Step 2: Get Database Connection String

1. Click **Settings** (gear icon) in the left sidebar
2. Click **Database** in the settings menu
3. Scroll down to **Connection string** section
4. Click on the **URI** tab (not Session mode)
5. You'll see something like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres
   ```
6. **Copy this entire string** (it includes your password)

## Step 3: Replace [YOUR-PASSWORD]

If the connection string shows `[YOUR-PASSWORD]`, you need to:
1. Go to **Settings** → **Database** → **Database password**
2. If you forgot it, click **Reset database password**
3. Copy the new password
4. Replace `[YOUR-PASSWORD]` in the connection string with your actual password

## Step 4: Your Final DATABASE_URL

It should look like:
```
postgresql://postgres:your-actual-password@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres
```

**Copy this - you'll need it for the environment variable!**

## Step 5: Test Connection (Optional)

You can test if the connection string works by running:
```powershell
cd backend
npx prisma db pull
```

If it works, you're good to go! ✅

