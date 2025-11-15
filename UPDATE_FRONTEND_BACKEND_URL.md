# 🔄 Update Frontend to Use New Backend URL

## ✅ Your New Backend URL

**Backend URL:** `https://backend-2c1k13ejq-trickals-projects.vercel.app`

## Step 1: Update Frontend Environment Variable

1. Go to: https://vercel.com/dashboard
2. Find your **frontend project** (tconnect-v2-0)
3. Click **Settings** → **Environment Variables**
4. Find `REACT_APP_API_BASE` or add it if it doesn't exist
5. Set the value to: `https://backend-2c1k13ejq-trickals-projects.vercel.app`
6. Make sure it's set for **Production**, **Preview**, and **Development**
7. Click **Save**

## Step 2: Redeploy Frontend

1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**

Or push a new commit to trigger auto-deployment.

## ✅ Done!

Your frontend will now connect to the new backend!

