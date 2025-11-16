# 🔧 Fix Backend Deployment Error

## The Problem
Vercel is trying to run `react-scripts build` (frontend command) in the backend project.

## The Solution

### Option 1: Fix Build Command in Vercel Dashboard

1. Go to your **backend project** in Vercel
2. Click **"Settings"** tab
3. Click **"General"** (left sidebar)
4. Scroll to **"Build & Development Settings"**
5. **Build Command:** Change to: `npm install`
   - Or: `cd backend && npm install`
   - Or: Leave it empty (Vercel will auto-detect)
6. **Output Directory:** Leave empty
7. **Install Command:** `npm install`
8. Click **"Save"**
9. Go to **"Deployments"** → Click **"Redeploy"** on latest deployment

### Option 2: Update vercel.json

The backend already has a `vercel.json` which should work. Make sure:
- Root Directory in Vercel is set to `backend`
- Build Command is either empty or `npm install`

### Option 3: Simplest Fix

1. In Vercel backend project settings:
   - **Build Command:** Leave EMPTY (Vercel will auto-detect)
   - **Output Directory:** Leave EMPTY
   - **Install Command:** `npm install`
2. **Root Directory:** Must be `backend`
3. Save and redeploy

## Why This Happens

Vercel detected Express but is still trying to use the root `package.json` which has React scripts. By setting Root Directory to `backend`, it should use `backend/package.json` instead.

## After Fix

The backend should deploy successfully and you'll get a URL like:
`https://backend-xxxxx.vercel.app`

Then update `src/lib/getApiBase.ts` with the new backend URL!

