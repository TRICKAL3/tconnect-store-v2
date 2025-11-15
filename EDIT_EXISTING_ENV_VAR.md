# ✏️ Edit Existing Environment Variable

## The Variable Already Exists!

You need to **EDIT** it, not create a new one.

---

## Step-by-Step:

### 1. Find the Existing Variable

1. **Go to:** https://vercel.com/trickals-projects/tconnect-v2-0/settings/environment-variables
2. **Look for `REACT_APP_API_BASE`** in the list
3. **You should see it with its current value**

### 2. Edit the Variable

1. **Click on `REACT_APP_API_BASE`** (click anywhere on that row)
2. **Or click the three dots (⋯)** next to it
3. **Click "Edit"** or just click on the value
4. **Change the value to:**
   ```
   https://backend-2c1k13ejq-trickals-projects.vercel.app
   ```
5. **Make sure all 3 environments are checked:**
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development
6. **Click "Save"**

### 3. Redeploy Frontend

**IMPORTANT:** After editing, you MUST redeploy!

1. **Go to:** https://vercel.com/trickals-projects/tconnect-v2-0/deployments
2. **Click three dots (⋯)** on latest deployment
3. **Click "Redeploy"**
4. **Wait 2-3 minutes**

---

## ✅ What to Check:

After editing, verify:
- **Value is:** `https://backend-2c1k13ejq-trickals-projects.vercel.app`
- **NOT:** `http://localhost:4000`
- **All 3 environments checked**

---

## 🆘 If You Can't Edit:

1. **Delete the old one first:**
   - Click three dots (⋯) → Delete
2. **Then add new one:**
   - Click "Add New"
   - Key: `REACT_APP_API_BASE`
   - Value: `https://backend-2c1k13ejq-trickals-projects.vercel.app`
   - Check all 3 environments
   - Save

---

## ✅ Done!

After editing and redeploying, all API errors should be fixed! 🎉

