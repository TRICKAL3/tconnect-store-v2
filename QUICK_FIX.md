# 🔧 Quick Fix for 405 Error

## The Problem
Getting "405 Method Not Allowed" when creating products.

## The Solution

The backend is deployed and working. The issue is likely:
1. Backend URL changed after redeployment
2. CORS or routing issue

## Quick Fix Steps:

### 1. Check Current Backend URL
- Go to Vercel Dashboard → Backend project → Deployments
- Copy the latest deployment URL (e.g., `https://backend-xxxxx.vercel.app`)

### 2. Update Frontend
- Edit `src/lib/getApiBase.ts`
- Change `BACKEND_URL` to the new backend URL
- Commit and push to GitHub
- Vercel will auto-deploy

### 3. Test
- Visit your frontend
- Try creating a product
- Should work now!

## Alternative: Use Environment Variable

Instead of hardcoding, use environment variable:

1. In Vercel Frontend project → Settings → Environment Variables
2. Add: `REACT_APP_API_BASE` = `https://your-backend-url.vercel.app`
3. Update `src/lib/getApiBase.ts` to check `process.env.REACT_APP_API_BASE` first
4. Redeploy

This way, you can update the backend URL without code changes!

