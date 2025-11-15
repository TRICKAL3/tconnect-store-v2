# Update Existing Environment Variable in Vercel

The `REACT_APP_API_BASE` variable already exists. Here's how to update it:

## Option 1: Via Vercel Dashboard (Easiest)

1. Go to **https://vercel.com/dashboard**
2. Click on your **`tconnect-v2-0`** project
3. Go to **Settings** → **Environment Variables**
4. Find **`REACT_APP_API_BASE`** in the list
5. Click the **three dots (⋯)** next to it → **Edit**
6. Update the **Value** to: `https://backend-72zfcspmp-trickals-projects.vercel.app`
7. Make sure it's enabled for **Production**, **Preview**, and **Development**
8. Click **Save**
9. **Redeploy** your frontend (or it will auto-redeploy on next push)

## Option 2: Via Vercel CLI

Run this command from the project root:

```powershell
npx vercel env rm REACT_APP_API_BASE production preview development
npx vercel env add REACT_APP_API_BASE production preview development
```

When prompted:
- **Value**: `https://backend-72zfcspmp-trickals-projects.vercel.app`
- **Add to**: Select all (Production, Preview, Development)

Then redeploy:
```powershell
npx vercel --prod --yes
```

## After Updating

The frontend will automatically use the new backend URL from the environment variable, which takes priority over the hardcoded URL in the code.

