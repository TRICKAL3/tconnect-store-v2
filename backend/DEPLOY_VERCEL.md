# ⚡ Deploy Backend to Vercel

Yes! You can deploy your backend directly to Vercel. It's the easiest option since you're already using Vercel for the frontend.

## ⚠️ Important Notes

1. **SQLite on Vercel**: Vercel's serverless functions have a read-only file system (except `/tmp`). SQLite will work, but the database file will be reset on each deployment. For production, consider using a hosted database like Supabase PostgreSQL or Railway PostgreSQL.

2. **Serverless Functions**: Vercel converts your Express app into serverless functions, which is perfect for APIs.

## 🚀 Step-by-Step Deployment

### Step 1: Create a New Vercel Project for Backend

1. Go to **https://vercel.com/dashboard**
2. Click **"Add New Project"**
3. **Import your Git repository** (same repo as frontend)
4. **Configure the project:**
   - **Project Name**: `tconnect-backend` (or any name)
   - **Framework Preset**: **Other** (or leave as auto-detect)
   - **Root Directory**: Click **"Edit"** → Set to: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: Leave empty (not needed for API)
   - **Install Command**: `npm install`

### Step 2: Add Environment Variables

Click **"Environment Variables"** and add:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=your-secure-admin-password-here
JWT_SECRET=your-random-secret-key-here
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ
VERCEL=1
```

**Generate Secrets:**
- For `JWT_SECRET`: Go to https://randomkeygen.com/ and copy a 256-bit key
- For `ADMIN_PASS`: Use a strong password you'll remember

**Important:**
- Set these for **Production**, **Preview**, and **Development** environments
- The `VERCEL=1` variable tells the app it's running on Vercel

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for deployment (usually 2-3 minutes)
3. Vercel will build and deploy your backend

### Step 4: Get Your Backend URL

1. Once deployed, you'll see your project URL
2. It will be like: `https://tconnect-backend.vercel.app`
3. **Copy this URL** - you'll need it!

### Step 5: Test Your Backend

1. Open: `https://your-backend-url.vercel.app/health`
2. Should see: `{"status":"ok"}`

### Step 6: Update Frontend

1. Go to your **frontend project** in Vercel
2. **Settings** → **Environment Variables**
3. Add/Update: `REACT_APP_API_BASE` = `https://your-backend-url.vercel.app`
4. **Redeploy** your frontend

## ✅ Done!

Your backend is now on Vercel! Both frontend and backend are in the same place.

## 🔧 Troubleshooting

### Build Fails
- Check **Deployments** tab for error logs
- Make sure **Root Directory** is set to `backend`
- Verify `package.json` has `postinstall` script for Prisma

### Database Resets
- **This is expected** on Vercel with SQLite
- Each deployment creates a fresh database
- For production, consider migrating to Supabase PostgreSQL or Railway PostgreSQL

### Routes Not Working
- Check that `vercel.json` is in the `backend` directory
- Verify the route pattern matches: `"src": "/(.*)"`

### CORS Errors
- Backend is configured to allow all origins
- If issues persist, check that backend URL is correct in frontend

## 📝 Alternative: Use Supabase PostgreSQL

For a persistent database on Vercel:

1. **Create Supabase Database:**
   - Go to https://supabase.com
   - Create a new project
   - Get the connection string

2. **Update Prisma Schema:**
   - Change `provider = "sqlite"` to `provider = "postgresql"`
   - Update `DATABASE_URL` to your Supabase connection string

3. **Run Migrations:**
   - `npx prisma migrate dev`

This way, your database persists across deployments!

## 🎯 Quick Checklist

- [ ] Created new Vercel project for backend
- [ ] Set Root Directory to `backend`
- [ ] Added all environment variables
- [ ] Deployed successfully
- [ ] Tested `/health` endpoint
- [ ] Updated frontend `REACT_APP_API_BASE`
- [ ] Redeployed frontend
- [ ] Verified API calls work from frontend

