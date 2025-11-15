# 🚂 Deploy Backend to Railway

Railway is the easiest option for deploying your backend. It's free to start and handles everything automatically.

## Step 1: Sign Up for Railway

1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign in with **GitHub** (recommended) or email

## Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: **tconnect v2.0**
4. Railway will detect it automatically

## Step 3: Configure the Project

1. **Set Root Directory:**
   - Click on your project
   - Go to **Settings** tab
   - Scroll to **Root Directory**
   - Set to: `backend`
   - Click **Save**

2. **Set Build Command:**
   - In **Settings** → **Build Command**
   - Set to: `npm install && npm run build`
   - (Prisma client will be generated automatically via postinstall script)
   - Click **Save**

3. **Set Start Command:**
   - In **Settings** → **Start Command**
   - Set to: `npm start`
   - Click **Save**

## Step 4: Add Environment Variables

Go to **Variables** tab and add these:

### Required Variables:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=your-secure-admin-password-here
JWT_SECRET=your-random-secret-key-here
```

### Optional (if using Supabase for chat images):

```
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

**Important:**
- Replace `your-secure-admin-password-here` with a strong password
- Replace `your-random-secret-key-here` with a random string (you can generate one at https://randomkeygen.com/)
- Railway will automatically set `PORT` - don't add it manually

## Step 5: Deploy

1. Railway will automatically start deploying
2. Wait for the deployment to complete (usually 2-3 minutes)
3. Check the **Deployments** tab to see the status

## Step 6: Get Your Backend URL

1. Once deployed, go to **Settings** tab
2. Scroll to **Domains** section
3. You'll see a URL like: `https://your-app-name.up.railway.app`
4. **Copy this URL** - you'll need it for the frontend!

## Step 7: Test Your Backend

1. Open the URL in your browser
2. Add `/health` to the end: `https://your-app-name.up.railway.app/health`
3. You should see: `{"status":"ok"}`

## Step 8: Update Frontend

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/Update: `REACT_APP_API_BASE` = `https://your-app-name.up.railway.app`
3. **Redeploy** your frontend

## ✅ Done!

Your backend is now live! The URL will be something like:
`https://tconnect-backend-production.up.railway.app`

## 🔧 Troubleshooting

### Build Fails
- Check the **Deployments** tab for error logs
- Make sure `Root Directory` is set to `backend`
- Verify all dependencies are in `package.json`

### Database Issues
- SQLite file will be created automatically
- If you need to run migrations: Railway provides a console where you can run `npx prisma migrate dev`

### Port Issues
- Railway automatically sets `PORT` - don't override it
- Your code already uses `process.env.PORT || 4000` which is correct

### CORS Errors
- The backend is configured to allow all origins
- If you still see CORS errors, check that the backend URL is correct in the frontend

