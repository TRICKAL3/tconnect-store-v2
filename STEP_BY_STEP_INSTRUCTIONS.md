# 📝 Step-by-Step Instructions - Super Easy!

## 🎯 What You Need to Do (2 Simple Steps)

---

## ✅ STEP 1: Update Frontend Backend URL (5 minutes)

### What You're Doing:
Telling your website to use the new backend server.

### Exact Steps:

1. **Open Vercel Dashboard**
   ```
   https://vercel.com/dashboard
   ```

2. **Click on Your Frontend Project**
   - Look for your project name (probably `tconnect-v2-0`)
   - Click on it

3. **Go to Settings → Environment Variables**
   - Click **Settings** tab (top of page)
   - Click **Environment Variables** (left menu)

4. **Add/Edit REACT_APP_API_BASE**
   - **If you see `REACT_APP_API_BASE` in the list:**
     - Click on it
     - Click **Edit**
     - Change value to: `https://backend-2c1k13ejq-trickals-projects.vercel.app`
     - Click **Save**
   
   - **If you DON'T see it:**
     - Click **Add New** button
     - **Key:** `REACT_APP_API_BASE`
     - **Value:** `https://backend-2c1k13ejq-trickals-projects.vercel.app`
     - **Environments:** Check all three boxes:
       - ☑️ Production
       - ☑️ Preview
       - ☑️ Development
     - Click **Save**

5. **Redeploy Your Frontend**
   - Click **Deployments** tab (top of page)
   - Find the latest deployment
   - Click the **three dots** (⋯) next to it
   - Click **Redeploy**
   - Wait 1-2 minutes for it to finish

✅ **Done with Step 1!**

---

## ✅ STEP 2: Create Database Tables (5 minutes)

### What You're Doing:
Creating all the database tables your app needs.

### Exact Steps:

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard
   ```

2. **Select Your Project**
   - Click on project: **cifqhaamcfqahrpurxpl**

3. **Open SQL Editor**
   - In left sidebar, click **SQL Editor**
   - Click **New query** button (top right, green button)

4. **Copy the SQL Code**
   - Open the file: `backend/CREATE_TABLES.sql`
   - Select ALL the text (Ctrl+A)
   - Copy it (Ctrl+C)

5. **Paste into Supabase**
   - Go back to Supabase SQL Editor
   - Paste the code (Ctrl+V) into the editor

6. **Run the SQL**
   - Click **Run** button (or press `Ctrl+Enter`)
   - Wait for "Success" message at the bottom

7. **Verify Tables Were Created**
   - In left sidebar, click **Table Editor**
   - You should see tables like:
     - User
     - Product
     - Order
     - Chat
     - etc.

✅ **Done with Step 2!**

---

## 🧪 STEP 3: Test Everything (2 minutes)

### Test 1: Backend Health
1. Open: https://backend-2c1k13ejq-trickals-projects.vercel.app/health
2. Should show: `{"status":"ok"}`

### Test 2: Your Website
1. Visit your frontend website
2. Try signing in/up
3. Try viewing products
4. Check if everything works

---

## ✅ You're All Done!

Your full-stack application is now live and working!

**Backend URL:** `https://backend-2c1k13ejq-trickals-projects.vercel.app`  
**Frontend:** Your Vercel frontend URL

---

## 🆘 Need Help?

**If Step 1 doesn't work:**
- Make sure you're in the correct Vercel project
- Check that the environment variable was saved
- Make sure you redeployed after adding the variable

**If Step 2 doesn't work:**
- Make sure you copied ALL the SQL code
- Check for any error messages in Supabase
- Try running the SQL again

**If something still doesn't work:**
- Tell me which step you're on
- Tell me what error you see
- I'll help you fix it!

