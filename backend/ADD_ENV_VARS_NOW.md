# ✅ Add Environment Variables - Copy These Values

Run these commands one by one. When prompted, paste the values below:

## 1. DATABASE_URL
```powershell
npx vercel env add DATABASE_URL production
```
**Value to paste:**
```
postgresql://postgres.cifqhaamcfqahrpurxpl:uzy8rGeq6zxTp60i@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## 2. ADMIN_PASS
```powershell
npx vercel env add ADMIN_PASS production
```
**Value to paste:** (Enter your admin password, e.g., `YourSecurePassword123!`)

## 3. JWT_SECRET
```powershell
npx vercel env add JWT_SECRET production
```
**Value to paste:** (Generate at https://randomkeygen.com/ - copy a 256-bit key)

## 4. SUPABASE_URL
```powershell
npx vercel env add SUPABASE_URL production
```
**Value to paste:**
```
https://cifqhaamcfqahrpurxpl.supabase.co
```

## 5. SUPABASE_KEY
```powershell
npx vercel env add SUPABASE_KEY production
```
**Value to paste:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
```

## 6. VERCEL
```powershell
npx vercel env add VERCEL production
```
**Value to paste:**
```
1
```

## After Adding All Variables

Run:
```powershell
npx vercel --prod
```

