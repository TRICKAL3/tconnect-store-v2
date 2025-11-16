# 📝 Add Environment Variables - Step by Step

## Go to Vercel Dashboard

1. **Open:** https://vercel.com/dashboard
2. **Click on your backend project:** `tconnect-backend` (or whatever you named it)
3. **Click "Settings"** tab (top menu)
4. **Click "Environment Variables"** (left sidebar)

## Add Each Variable (One at a Time)

For each variable below:
1. Click **"Add New"** button
2. Enter the **Key** and **Value**
3. **Check all 3 boxes:** ✅ Production, ✅ Preview, ✅ Development
4. Click **"Save"**
5. Repeat for next variable

---

## Variable 1: DATABASE_URL

- **Key:** `DATABASE_URL`
- **Value:** `postgresql://postgres.cifqhaamcfqahrpurxpl:uzy8rGeq6zxTp60i@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## Variable 2: ADMIN_PASS

- **Key:** `ADMIN_PASS`
- **Value:** `09090808pP#`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## Variable 3: JWT_SECRET

- **Key:** `JWT_SECRET`
- **Value:** `my-secret-jwt-key-12345-change-this-later`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

**Note:** For production, use a stronger random key from https://randomkeygen.com/

---

## Variable 4: SUPABASE_URL

- **Key:** `SUPABASE_URL`
- **Value:** `https://cifqhaamcfqahrpurxpl.supabase.co`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## Variable 5: SUPABASE_KEY

- **Key:** `SUPABASE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## Variable 6: VERCEL

- **Key:** `VERCEL`
- **Value:** `1`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## After Adding All Variables

1. Go to **"Deployments"** tab
2. Click the **three dots (⋯)** on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to finish (2-3 minutes)

---

## ✅ Done!

Your backend now has all the environment variables it needs!

**Test it:**
- Visit: `https://tconnect-backend-2k8q7yzk6-trickals-projects.vercel.app/health`
- Should return: `{"status":"ok"}`

