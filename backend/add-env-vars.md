# Add Environment Variables - Copy & Paste These Commands

Run these commands one by one from the `backend` directory.
You'll be prompted to enter the value for each.

## Commands to Run:

```powershell
# 1. DATABASE_URL
npx vercel env add DATABASE_URL production
# When prompted, enter: file:./prisma/dev.db

# 2. ADMIN_PASS
npx vercel env add ADMIN_PASS production
# When prompted, enter: YourSecurePassword123!

# 3. JWT_SECRET
npx vercel env add JWT_SECRET production
# When prompted, enter: (paste your generated key from https://randomkeygen.com/)

# 4. SUPABASE_URL
npx vercel env add SUPABASE_URL production
# When prompted, enter: https://cifqhaamcfqahrpurxpl.supabase.co

# 5. SUPABASE_KEY
npx vercel env add SUPABASE_KEY production
# When prompted, enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ

# 6. VERCEL
npx vercel env add VERCEL production
# When prompted, enter: 1
```

