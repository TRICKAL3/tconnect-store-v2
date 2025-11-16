# 🚀 QUICK START - Unified Setup

## ✅ What I Just Did

1. ✅ Moved all backend code into `/api` folder (same project!)
2. ✅ Updated frontend to use `/api` (same domain = no CORS!)
3. ✅ Added all backend dependencies to `package.json`
4. ✅ Updated `vercel.json` to handle API routes
5. ✅ Pushed everything to GitHub

## 🎯 Next Steps (3 Simple Steps)

### Step 1: Install Dependencies Locally (Optional - for testing)

```bash
npm install
```

This installs everything (frontend + backend) and generates Prisma client.

### Step 2: Add Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these 3 variables:

```
DATABASE_URL=postgresql://... (your Supabase connection string)
ADMIN_PASS=09090808pP# (your admin password)
JWT_SECRET=any-random-string-here (make one up)
```

**Important:** Set them for **Production, Preview, AND Development** environments!

### Step 3: Deploy (Automatic!)

If you have Vercel connected to GitHub, it will auto-deploy!

If not:
1. Go to Vercel Dashboard
2. Import your GitHub repo
3. It will detect the setup automatically

## 🎉 That's It!

After deployment:

- **Frontend:** `https://yourdomain.com`
- **API:** `https://yourdomain.com/api/products`
- **Same domain = No more errors!**

## 🧪 Test It

1. Visit: `https://yourdomain.com/api/health`
   - Should show: `{"status":"ok"}`

2. Visit: `https://yourdomain.com`
   - Try creating a product
   - Should work without errors!

## 📝 Database Setup

If you need to set up the database tables:

**Option 1: Prisma (if connection works)**
```bash
npx prisma db push
```

**Option 2: Supabase SQL Editor**
1. Go to Supabase → SQL Editor
2. Copy SQL from `backend/CREATE_TABLES.sql` (if exists)
3. Run it

## 🐛 If Something Breaks

1. Check Vercel deployment logs
2. Make sure environment variables are set
3. Check `DATABASE_URL` is correct
4. See `UNIFIED_SETUP.md` for detailed troubleshooting

---

**You're done!** Everything is now in one place. No more separate backends, no more CORS issues! 🎉

