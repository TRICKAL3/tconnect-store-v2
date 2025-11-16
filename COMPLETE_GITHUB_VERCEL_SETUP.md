# 📚 Complete Guide: Push to GitHub & Connect to Vercel

## Part 1: Push Your Code to GitHub

### Step 1: Create GitHub Repository

1. **Open your web browser**
2. **Go to:** https://github.com/new
3. **Sign in** to GitHub (or create an account if you don't have one)
4. **Fill in the form:**
   - **Repository name:** `tconnect-store-v2` (or any name you want)
   - **Description:** (optional) "TConnect Store v2.0 - Gift Cards & Crypto"
   - **Visibility:** 
     - Choose **Private** (only you can see it) OR
     - Choose **Public** (anyone can see it)
   - **IMPORTANT:** Do NOT check these boxes:
     - ❌ "Add a README file"
     - ❌ "Add .gitignore"
     - ❌ "Choose a license"
5. **Click the green "Create repository" button**

### Step 2: Get Your Repository URL

After creating the repository, GitHub will show you a page with setup instructions. You'll see a URL like:
```
https://github.com/YOUR_USERNAME/tconnect-store-v2.git
```

**Copy this URL** - you'll need it in the next step!

### Step 3: Push Your Code from PowerShell

Open PowerShell in your project folder (you're already there) and run these commands:

#### Command 1: Connect to GitHub
```powershell
git remote add origin https://github.com/YOUR_USERNAME/tconnect-store-v2.git
```
**Replace `YOUR_USERNAME` with your actual GitHub username!**

For example, if your username is `trickal`, it would be:
```powershell
git remote add origin https://github.com/trickal/tconnect-store-v2.git
```

#### Command 2: Rename branch to main
```powershell
git branch -M main
```

#### Command 3: Push your code
```powershell
git push -u origin main
```

**If it asks for credentials:**
- **Username:** Your GitHub username
- **Password:** Use a **Personal Access Token** (NOT your GitHub password)

**How to create a Personal Access Token:**
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: "Vercel Deployment"
4. Check these boxes:
   - ✅ `repo` (Full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

**After pushing, you should see:**
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Writing objects: 100% (X/X), done.
To https://github.com/YOUR_USERNAME/tconnect-store-v2.git
 * [new branch]      main -> main
```

✅ **Your code is now on GitHub!**

---

## Part 2: Connect Frontend to Vercel

### Step 1: Go to Vercel Dashboard

1. **Open your web browser**
2. **Go to:** https://vercel.com/dashboard
3. **Sign in** (or create an account if needed)

### Step 2: Import Your Repository

1. **Click the big "Add New" button** (usually at the top right)
2. **Click "Project"** from the dropdown
3. **You'll see "Import Git Repository"**
4. **If you see your GitHub account:**
   - Click **"Import"** next to your GitHub account
   - You might need to authorize Vercel to access GitHub
   - Click **"Authorize Vercel"** if prompted
5. **Find your repository:**
   - Look for `tconnect-store-v2` (or whatever you named it)
   - Click **"Import"** next to it

### Step 3: Configure Frontend Project

After clicking Import, you'll see a configuration page:

1. **Project Name:** 
   - Keep it as `tconnect-store-v2` or change it
   - This will be part of your URL

2. **Framework Preset:**
   - Vercel should auto-detect "Create React App"
   - If not, select **"Create React App"** from the dropdown

3. **Root Directory:**
   - Click **"Edit"** button
   - Type: `./` (just a dot and slash)
   - Or leave it empty (default is root)
   - Click **"Continue"**

4. **Build and Output Settings:**
   - **Build Command:** Should be `npm run build` (auto-filled)
   - **Output Directory:** Should be `build` (auto-filled)
   - **Install Command:** Should be `npm install` (auto-filled)
   - If these are correct, leave them as is

5. **Environment Variables:**
   - You can add them now or later
   - For now, click **"Deploy"** (we'll add them after)

### Step 4: Wait for Deployment

1. **Vercel will start building:**
   - You'll see a progress screen
   - It shows: "Installing dependencies..." → "Building..." → "Deploying..."
   - This takes 2-5 minutes

2. **When it's done:**
   - You'll see a green checkmark ✅
   - You'll get a URL like: `https://tconnect-v2-0-xxxxx.vercel.app`
   - **Copy this URL!**

### Step 5: Add Environment Variables (Optional but Recommended)

1. **Click on your project** in the Vercel dashboard
2. **Click "Settings"** tab (top menu)
3. **Click "Environment Variables"** (left sidebar)
4. **Add this variable:**
   - **Key:** `REACT_APP_API_BASE`
   - **Value:** `https://backend-e5399lu6s-trickals-projects.vercel.app`
   - **Environments:** Check all three:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
5. **Click "Save"**
6. **Go to "Deployments"** tab
7. **Click the three dots (⋯)** on the latest deployment
8. **Click "Redeploy"**
9. **Wait for it to finish**

---

## Part 3: Connect Backend to Vercel

### Step 1: Add Another Project

1. **Still in Vercel Dashboard**
2. **Click "Add New"** → **"Project"** again
3. **Import the SAME repository** (`tconnect-store-v2`)

### Step 2: Configure Backend Project

1. **Project Name:** 
   - Name it `tconnect-backend` (or `backend`)

2. **Framework Preset:**
   - Select **"Other"** from the dropdown

3. **Root Directory:**
   - Click **"Edit"**
   - Type: `backend` (just the word "backend")
   - Click **"Continue"**

4. **Build and Output Settings:**
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** Leave empty (not needed for API)
   - **Install Command:** `npm install`

5. **Click "Deploy"**

### Step 3: Add Backend Environment Variables

1. **After deployment, click on the backend project**
2. **Settings** → **Environment Variables**
3. **Add these variables:**

   **Variable 1:**
   - Key: `DATABASE_URL`
   - Value: Your PostgreSQL connection string
   - Environments: ✅ All three

   **Variable 2:**
   - Key: `ADMIN_PASS`
   - Value: `09090808pP#`
   - Environments: ✅ All three

   **Variable 3:**
   - Key: `JWT_SECRET`
   - Value: Any random string (e.g., `my-secret-key-12345`)
   - Environments: ✅ All three

   **Variable 4:**
   - Key: `SUPABASE_URL`
   - Value: `https://cifqhaamcfqahrpurxpl.supabase.co`
   - Environments: ✅ All three

   **Variable 5:**
   - Key: `SUPABASE_KEY`
   - Value: Your Supabase anon key
   - Environments: ✅ All three

   **Variable 6:**
   - Key: `VERCEL`
   - Value: `1`
   - Environments: ✅ All three

4. **Click "Save"** after each one
5. **Go to Deployments** → **Redeploy** the latest deployment

---

## Part 4: Update Frontend with New Backend URL

After backend is deployed, you'll get a new URL (like `https://backend-xxxxx.vercel.app`):

1. **Copy the new backend URL** from Vercel
2. **Update `src/lib/getApiBase.ts`:**
   - Change `BACKEND_URL` to the new URL
3. **Commit and push:**
   ```powershell
   git add src/lib/getApiBase.ts
   git commit -m "Update backend URL"
   git push
   ```
4. **Vercel will automatically redeploy** the frontend!

---

## ✅ How Auto-Deploy Works

**Once connected to GitHub:**
- Every time you run `git push`, Vercel automatically:
  1. Detects the new code
  2. Builds your project
  3. Deploys it
  4. Gives you a new URL (or updates the existing one)

**No more manual deployments needed!**

---

## 🎯 Quick Reference

### Push Code to GitHub:
```powershell
git add .
git commit -m "Your message"
git push
```

### Check Deployment Status:
- Go to Vercel Dashboard → Your Project → Deployments
- Green checkmark = Success ✅
- Red X = Failed ❌

### View Logs:
- Click on a deployment
- Click "Functions" or "Build Logs" tab
- See what happened during build/deploy

---

## 🆘 Troubleshooting

### "Repository not found"
- Make sure you've pushed to GitHub first
- Check that the repository name is correct
- Make sure Vercel has access to your GitHub account

### "Build failed"
- Check the build logs in Vercel
- Make sure all dependencies are in `package.json`
- Check for TypeScript errors

### "Environment variable not working"
- Make sure you redeployed after adding variables
- Check that the variable name is exactly correct
- For React apps, variables must start with `REACT_APP_`

---

## 🎉 You're Done!

Now every time you:
1. Make changes to your code
2. Run `git add .` and `git commit -m "message"`
3. Run `git push`

Vercel will automatically deploy your changes! No more manual deployments! 🚀

