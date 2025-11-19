# ✅ Database Done! Now Redeploy

## Step 1: Add Environment Variables (2 minutes)

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

### Add Variable 1: ADMIN_PASS
1. Click **"Add New"**
2. **Key:** `ADMIN_PASS`
3. **Value:** `09090808pP#`
4. **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Click **"Save"**

### Add Variable 2: JWT_SECRET
1. Click **"Add New"**
2. **Key:** `JWT_SECRET`
3. **Value:** `my-secret-jwt-key-12345` (or any random string)
4. **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Click **"Save"**

**Note:** `DATABASE_URL` should already be there ✅

---

## Step 2: Redeploy

1. Go to **"Deployments"** tab
2. Find the **latest deployment**
3. Click the **3 dots (⋯)** on the right
4. Click **"Redeploy"**
5. Click **"Redeploy"** again to confirm
6. **Wait 2-3 minutes** for it to finish

---

## Step 3: Test (After Deployment)

1. **Test API:** Visit `https://yourdomain.com/api/health`
   - Should show: `{"status":"ok"}` ✅

2. **Test Product Creation:**
   - Go to Admin panel: `https://yourdomain.com/admin`
   - Password: `09090808pP#`
   - Try creating a product
   - Should work now! ✅

---

**After adding the 2 environment variables, redeploy and test!** 🚀

