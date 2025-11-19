# ✅ Next Steps - After Creating Vercel Postgres Database

## ✅ Step 1: Verify DATABASE_URL is Set (Already Done!)

**Good news!** Vercel automatically added `DATABASE_URL` to your environment variables when you created the database.

**To verify:**
1. Go to: **Settings** → **Environment Variables**
2. You should see `DATABASE_URL` in the list (it's masked with `************`)
3. ✅ It's already there! No need to add it manually.

## ✅ Step 2: Add Other Required Environment Variables

Make sure these are also set:

1. **ADMIN_PASS**
   - Key: `ADMIN_PASS`
   - Value: `09090808pP#`
   - Environments: Production, Preview, Development

2. **JWT_SECRET**
   - Key: `JWT_SECRET`
   - Value: Any random string (e.g., `my-secret-key-12345`)
   - Environments: Production, Preview, Development

**To add:**
- Go to: **Settings** → **Environment Variables**
- Click **"Add New"**
- Add each variable above
- Make sure to check all 3 environments (Production, Preview, Development)

## ✅ Step 3: Push Database Schema

You have 2 options:

### Option A: Use Prisma (Recommended)

**If you can run commands locally:**

```powershell
# Make sure you're in the project root
cd "C:\Users\TRICKALHOLDINGS\OneDrive\Desktop\tconnect v2.0"

# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push
```

**Note:** This requires the DATABASE_URL to be accessible from your local machine. If it fails, use Option B.

### Option B: Use Vercel SQL Editor (Easier)

1. Go to: **Vercel Dashboard** → Your Project → **Storage** tab
2. Click on your database
3. Look for **"SQL Editor"** or **"Query"** tab
4. Copy the SQL from `backend/CREATE_TABLES.sql` (if it exists)
5. Paste and run it

**OR** I can generate the SQL for you to run!

## ✅ Step 4: Test the API

After pushing the schema:

1. **Redeploy your project** (or wait for auto-deploy)
2. **Test the API:**
   - Visit: `https://yourdomain.com/api/health`
   - Should show: `{"status":"ok"}`
3. **Test product creation:**
   - Go to Admin panel
   - Try creating a product
   - Should work now! ✅

## 🎯 Quick Checklist

- [x] Database created ✅
- [x] DATABASE_URL auto-added ✅
- [ ] ADMIN_PASS added to environment variables
- [ ] JWT_SECRET added to environment variables
- [ ] Database schema pushed (tables created)
- [ ] Project redeployed
- [ ] API tested (`/api/health`)

---

**Tell me which option you want for Step 3 (pushing schema), and I'll guide you!**

