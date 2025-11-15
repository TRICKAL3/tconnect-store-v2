# 🎨 Deploy Backend to Render

Render is another great option for deploying your backend. It has a free tier.

## Step 1: Sign Up for Render

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Sign in with **GitHub** (recommended)

## Step 2: Create New Web Service

1. Click **"New +"** button
2. Select **"Web Service"**
3. Connect your GitHub repository: **tconnect v2.0**

## Step 3: Configure the Service

Fill in the form:

- **Name**: `tconnect-backend` (or any name you like)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

## Step 4: Add Environment Variables

Scroll down to **Environment Variables** and add:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=your-secure-admin-password-here
JWT_SECRET=your-random-secret-key-here
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

**Important:**
- Replace `your-secure-admin-password-here` with a strong password
- Replace `your-random-secret-key-here` with a random string
- Render automatically sets `PORT` - don't add it

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying
3. Wait for deployment to complete (usually 3-5 minutes)

## Step 6: Get Your Backend URL

1. Once deployed, you'll see your service URL at the top
2. It will be like: `https://tconnect-backend.onrender.com`
3. **Copy this URL** - you'll need it for the frontend!

## Step 7: Test Your Backend

1. Open the URL in your browser
2. Add `/health` to the end: `https://tconnect-backend.onrender.com/health`
3. You should see: `{"status":"ok"}`

## Step 8: Update Frontend

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/Update: `REACT_APP_API_BASE` = `https://tconnect-backend.onrender.com`
3. **Redeploy** your frontend

## ✅ Done!

Your backend is now live!

## 🔧 Troubleshooting

### Service Goes to Sleep (Free Tier)
- Render free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Consider upgrading to paid plan for always-on service

### Build Fails
- Check the **Logs** tab for error messages
- Make sure `Root Directory` is set to `backend`
- Verify build command includes `npx prisma generate`

### Database Issues
- SQLite file will be created automatically in the service
- Data persists between deployments

