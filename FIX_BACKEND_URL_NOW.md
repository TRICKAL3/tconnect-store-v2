# 🔧 FIX BACKEND URL - DO THIS NOW!

## The Problem:
Backend URL keeps changing and breaking. Let's fix it permanently!

## ✅ SOLUTION: Use Environment Variable

### Step 1: Get Your Current Backend URL

1. Go to: https://vercel.com/dashboard
2. Click your **BACKEND project** (`tconnect-backend`)
3. **Copy the URL** shown at the top (e.g., `https://tconnect-backend-xxxxx.vercel.app`)

### Step 2: Add to Frontend Environment Variables

1. Go to your **FRONTEND project** in Vercel
2. **Settings** → **Environment Variables**
3. **Add or Edit:**
   - **Key:** `REACT_APP_API_BASE`
   - **Value:** Paste your backend URL (from Step 1)
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
4. **Click "Save"**

### Step 3: Redeploy Frontend

1. Go to **Deployments** tab
2. Click **three dots (⋯)** on latest deployment
3. Click **"Redeploy"**
4. Wait 2-3 minutes

### Step 4: Update Code (Optional - for fallback)

If you want, also update the fallback URL in `src/lib/getApiBase.ts`:
- Change `FALLBACK_BACKEND_URL` to your current backend URL
- Commit and push

---

## ✅ After This:

- Frontend will use `REACT_APP_API_BASE` from environment variables
- If backend URL changes, just update the environment variable (no code changes!)
- Much more reliable! 🎯

---

**DO THIS NOW and it will work!** 🚀

