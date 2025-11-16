# 🚀 Deploy to GitHub + Vercel

## Step 1: Create GitHub Repository

1. Go to **https://github.com/new**
2. Repository name: `tconnect-store-v2` (or any name)
3. Make it **Private** or **Public** (your choice)
4. **DON'T** check "Initialize with README"
5. Click **"Create repository"**

## Step 2: Push to GitHub

Run these commands (replace `YOUR_USERNAME` with your GitHub username):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/tconnect-store-v2.git
git branch -M main
git push -u origin main
```

If it asks for credentials, use a **Personal Access Token** (not your password).

## Step 3: Deploy Frontend to Vercel

1. Go to **https://vercel.com/dashboard**
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your **`tconnect-store-v2`** repository
5. Configure:
   - **Framework Preset:** Create React App
   - **Root Directory:** `./` (root - leave as is)
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
   - **Install Command:** `npm install`
6. Click **"Deploy"**

## Step 4: Deploy Backend to Vercel

1. Still in Vercel, click **"Add New Project"** again
2. Select the **same repository** (`tconnect-store-v2`)
3. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** Click **"Edit"** → Type: `backend`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** Leave empty
   - **Install Command:** `npm install`
4. Click **"Deploy"**

## Step 5: Add Environment Variables

### Frontend Project:
- Go to **Settings → Environment Variables**
- Add: `REACT_APP_API_BASE` = `https://YOUR-BACKEND-URL.vercel.app`
- Set for: Production, Preview, Development
- **Redeploy** after adding

### Backend Project:
- Go to **Settings → Environment Variables**
- Add these:
  ```
  DATABASE_URL=your-postgresql-connection-string
  ADMIN_PASS=09090808pP#
  JWT_SECRET=your-random-secret-key
  SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
  SUPABASE_KEY=your-supabase-key
  VERCEL=1
  ```
- Set for: Production, Preview, Development
- **Redeploy** after adding

## Step 6: Update Frontend Backend URL

After backend is deployed, update `src/lib/getApiBase.ts`:
- Change `BACKEND_URL` to your new backend URL
- Commit and push to GitHub
- Vercel will auto-deploy

## ✅ Done!

Now every time you push to GitHub, both frontend and backend will auto-deploy!

