# Environment Variables for Vercel Backend

## ⚠️ IMPORTANT: Database Issue

**SQLite file-based databases (`file:./prisma/dev.db`) DO NOT work on Vercel!**

Vercel is serverless and doesn't have persistent file storage. You need to migrate to a cloud database.

## Temporary Values (For Testing)

Use these values to deploy, but **you'll need to migrate to a cloud database**:

```
DATABASE_URL = file:./prisma/dev.db
ADMIN_PASS = YourSecurePassword123!
JWT_SECRET = (generate at https://randomkeygen.com/ - use 256-bit key)
SUPABASE_URL = https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
VERCEL = 1
```

## 🔄 Recommended: Migrate to PostgreSQL

### Option 1: Use Supabase PostgreSQL (Free)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Go to **Settings** → **Database**
3. Copy the **Connection String** (URI format)
4. It will look like: `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`
5. Use this as your `DATABASE_URL`

### Option 2: Use Vercel Postgres (Free Tier)

1. Go to: https://vercel.com/dashboard
2. Create a **Postgres** database
3. Copy the connection string
4. Use as `DATABASE_URL`

### Option 3: Use Turso (SQLite Cloud - Free)

1. Sign up at: https://turso.tech
2. Create a database
3. Get connection string
4. Use as `DATABASE_URL`

## 📝 After Getting Cloud Database

1. Update `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // or "sqlite" if using Turso
     url      = env("DATABASE_URL")
   }
   ```

2. Run migrations:
   ```powershell
   cd backend
   npx prisma migrate dev --name migrate_to_cloud
   ```

3. Update `DATABASE_URL` in Vercel with your cloud database connection string

