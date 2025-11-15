# 🚀 Complete Setup Guide - GitHub + Vercel

## What We're Doing

Setting up a **monorepo** where:
- Frontend uses **relative URLs** (`/api/*`) 
- Vercel **proxies** all `/api/*` requests to your backend
- **No more URL configuration issues!**
- Everything works together seamlessly

---

## Step 1: Initialize Git & Push to GitHub

### 1.1 Initialize Git Repository

```powershell
git init
git add .
git commit -m "Initial commit - TConnect Store v2.0"
```

### 1.2 Create GitHub Repository

1. Go to **https://github.com/new**
2. Repository name: `tconnect-store-v2` (or any name you want)
3. Make it **Private** or **Public** (your choice)
4. **DON'T** initialize with README, .gitignore, or license
5. Click **"Create repository"**

### 1.3 Push to GitHub

GitHub will show you commands. Use these:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/tconnect-store-v2.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2: Connect to Vercel

### 2.1 Frontend Project (Main)

1. Go to **https://vercel.com/dashboard**
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your **`tconnect-store-v2`** repository
5. Configure:
   - **Framework Preset:** Create React App
   - **Root Directory:** `./` (root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
   - **Install Command:** `npm install`
6. Click **"Deploy"**

### 2.2 Add Environment Variables

After deployment, go to **Settings → Environment Variables** and add:

```
BACKEND_URL = https://backend-72zfcspmp-trickals-projects.vercel.app
```

Set for: **Production**, **Preview**, **Development**

### 2.3 Redeploy

After adding the environment variable, go to **Deployments** and click **"Redeploy"** on the latest deployment.

---

## Step 3: Backend Project (Separate)

The backend is already deployed separately. You can:

### Option A: Keep Backend Separate (Current Setup)
- Backend stays as a separate Vercel project
- Frontend proxies to it via `/api/*`
- **This is what we set up!**

### Option B: Move Backend to Same Repo (Future)
- Move `backend/` folder to the repo
- Configure Vercel to handle both
- More complex but everything in one place

**For now, Option A is simpler and works perfectly!**

---

## ✅ How It Works Now

1. **Frontend** calls `/api/products`, `/api/orders`, etc.
2. **Vercel** routes `/api/*` to `api/index.ts` (proxy function)
3. **Proxy** forwards request to your backend
4. **Backend** processes and returns response
5. **Proxy** returns response to frontend

**Result:** Frontend always uses the same domain, no URL configuration needed!

---

## 🎯 Test It

1. Visit your deployed frontend
2. Open browser console (F12)
3. Try creating a product
4. Should work! ✅

---

## 🔧 If Something Goes Wrong

### Check Environment Variable
- Go to Vercel → Settings → Environment Variables
- Make sure `BACKEND_URL` is set correctly
- Redeploy after adding/changing

### Check Backend
- Visit: `https://backend-72zfcspmp-trickals-projects.vercel.app/health`
- Should return: `{"status":"ok"}`

### Check Console
- Open browser console (F12)
- Look for `[API Proxy]` logs
- Check for any errors

---

## 🎉 Done!

Your frontend and backend are now connected via Vercel's proxy system. No more URL configuration headaches!

