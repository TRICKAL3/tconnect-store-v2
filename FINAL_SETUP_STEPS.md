# ✅ Final Setup Steps - Backend Deployed!

## Step 1: Get Your Backend URL

1. Go to your **backend project** in Vercel Dashboard
2. Click on the project
3. You'll see a URL like: `https://tconnect-backend-xxxxx.vercel.app`
4. **Copy this URL!**

## Step 2: Update Frontend Backend URL

1. **Option A: Update Code (Recommended)**
   - Edit `src/lib/getApiBase.ts`
   - Change `BACKEND_URL` to your new backend URL
   - Commit and push:
     ```powershell
     git add src/lib/getApiBase.ts
     git commit -m "Update backend URL"
     git push
     ```
   - Vercel will auto-deploy frontend

2. **Option B: Use Environment Variable**
   - Go to **frontend project** in Vercel
   - Settings → Environment Variables
   - Add: `REACT_APP_API_BASE` = your backend URL
   - Set for: Production, Preview, Development
   - Redeploy frontend

## Step 3: Add Backend Environment Variables

Go to **backend project** → Settings → Environment Variables, add:

```
DATABASE_URL=your-postgresql-connection-string
ADMIN_PASS=09090808pP#
JWT_SECRET=any-random-secret-key-here
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=your-supabase-anon-key
VERCEL=1
```

After adding, **redeploy backend**.

## Step 4: Test Everything

1. Visit your frontend URL
2. Try creating a product in Admin
3. Check Order History
4. Should all work now! ✅

---

## 🎉 You're Done!

Your backend and frontend are now:
- ✅ Deployed to Vercel
- ✅ Connected via GitHub
- ✅ Auto-deploying on every push

**Every time you push to GitHub, both will auto-update!** 🚀

