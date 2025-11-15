# 🔍 How to Find Supabase Connection String

## Method 1: Settings → Database

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Sign in

2. **Select Your Project:**
   - Click on the project that has URL: `cifqhaamcfqahrpurxpl.supabase.co`

3. **Go to Settings:**
   - Look for a **gear icon (⚙️)** in the left sidebar
   - Click **Settings**

4. **Click Database:**
   - In the Settings menu, click **Database**

5. **Find Connection String:**
   - Scroll down the page
   - Look for a section called **"Connection string"** or **"Connection pooling"**
   - You should see tabs like: **URI**, **JDBC**, **Session mode**, etc.
   - Click the **URI** tab
   - The connection string should be visible there

## Method 2: Project Settings → Database

1. **Go to Project Settings:**
   - Click on your project name at the top
   - Or go to: https://supabase.com/dashboard/project/cifqhaamcfqahrpurxpl/settings/database

2. **Look for "Connection string" section**

## Method 3: If You Still Can't Find It

The connection string format is:
```
postgresql://postgres:[YOUR-PASSWORD]@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres
```

**You need to:**
1. Get your database password:
   - Go to **Settings** → **Database**
   - Look for **"Database password"** section
   - If you don't know it, click **"Reset database password"**
   - Copy the password

2. Replace `[YOUR-PASSWORD]` in the connection string above with your actual password

## Method 4: Use Connection Pooling (Recommended for Serverless)

1. Go to **Settings** → **Database**
2. Look for **"Connection pooling"** section
3. Enable it if not already enabled
4. Use the **"Transaction"** mode connection string
5. It will look like: `postgresql://postgres.cifqhaamcfqahrpurxpl:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

## Quick Test

If you can't find it, we can construct it manually:
- Host: `db.cifqhaamcfqahrpurxpl.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: (get from Settings → Database → Database password)

Let me know what you see in the Database settings page!

