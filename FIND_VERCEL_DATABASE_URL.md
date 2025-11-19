# 🔍 How to Find Vercel Postgres DATABASE_URL

## Step-by-Step:

### Step 1: Go to Your Project
1. Go to: **https://vercel.com/dashboard**
2. Click on your project (the one you're deploying)

### Step 2: Find the Database
1. In your project, look for tabs at the top:
   - **Deployments**
   - **Analytics**
   - **Storage** ← **Click this!**

2. OR look in the left sidebar for **"Storage"**

### Step 3: View Database Details
1. You should see your Postgres database listed
2. Click on the database name
3. You'll see database details

### Step 4: Get the Connection String
1. Look for a section called:
   - **"Connection String"**
   - **"Connection URL"**
   - **"DATABASE_URL"**
   - **"Environment Variable"**

2. It will look like:
   ```
   postgres://default:xxxxx@xxxxx.vercel-storage.com:5432/verceldb
   ```

3. **Copy this entire string**

### Step 5: Add to Environment Variables
1. In your project, go to: **Settings** → **Environment Variables**
2. Look for `DATABASE_URL` - it might already be there!
3. If it's NOT there:
   - Click **"Add New"**
   - Key: `DATABASE_URL`
   - Value: Paste the connection string you copied
   - Environments: Select **Production, Preview, Development**
   - Click **Save**

## ✅ Quick Check:

**Vercel might have already added it automatically!**

1. Go to: **Settings** → **Environment Variables**
2. Look for `DATABASE_URL` in the list
3. If you see it, it's already set! ✅
4. If not, follow Step 5 above

## 📸 Where to Look:

The connection string is usually shown in:
- **Storage** tab → Click your database → **Connection String** section
- OR **Settings** → **Environment Variables** (might already be there)

---

**Check Settings → Environment Variables first - it might already be there!**

