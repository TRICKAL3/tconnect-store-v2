# 🚀 Setup Database for Vercel - Step by Step

## Step 1: Get Supabase PostgreSQL Connection String

1. Go to: https://supabase.com/dashboard
2. Select your project
3. **Settings** → **Database**
4. Scroll to **Connection string** section
5. Click **URI** tab
6. Copy the connection string (looks like: `postgresql://postgres:[password]@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres`)
7. If it shows `[YOUR-PASSWORD]`, go to **Database password** section and reset/copy your password, then replace `[YOUR-PASSWORD]` in the connection string

## Step 2: Run Database Migration

Once you have the connection string, run this locally first to create the tables:

```powershell
cd backend

# Set your DATABASE_URL temporarily (replace with your actual connection string)
$env:DATABASE_URL="postgresql://postgres:your-password@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres"

# Generate Prisma client for PostgreSQL
npx prisma generate

# Push schema to Supabase (creates all tables)
npx prisma db push
```

## Step 3: Add Environment Variables to Vercel

Now add all environment variables with the correct database URL:

```powershell
# 1. DATABASE_URL (use your Supabase PostgreSQL connection string)
npx vercel env add DATABASE_URL production
# Paste your connection string when prompted

# 2. ADMIN_PASS
npx vercel env add ADMIN_PASS production
# Enter: YourSecurePassword123!

# 3. JWT_SECRET (generate at https://randomkeygen.com/)
npx vercel env add JWT_SECRET production
# Enter: (paste your generated 256-bit key)

# 4. SUPABASE_URL
npx vercel env add SUPABASE_URL production
# Enter: https://cifqhaamcfqahrpurxpl.supabase.co

# 5. SUPABASE_KEY
npx vercel env add SUPABASE_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ

# 6. VERCEL
npx vercel env add VERCEL production
# Enter: 1
```

## Step 4: Redeploy Backend

```powershell
npx vercel --prod
```

## ✅ Done!

Your backend is now using Supabase PostgreSQL which works perfectly on Vercel!

