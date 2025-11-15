# 🚀 STEP 1: Update Frontend - Super Simple Version

## What You Need to Do
Change where your website looks for the backend server.

---

## The Steps (Copy & Follow)

### 1. Open Vercel
```
https://vercel.com/dashboard
```

### 2. Click Your Frontend Project
- NOT the "backend" project
- The OTHER project (your website)

### 3. Click "Settings" Tab
- Top of the page

### 4. Click "Environment Variables"
- Left sidebar

### 5. Add This Variable
- Click **"Add New"** button
- **Key:** `REACT_APP_API_BASE`
- **Value:** `https://backend-2c1k13ejq-trickals-projects.vercel.app`
- Check all 3 boxes: Production, Preview, Development
- Click **"Save"**

### 6. Redeploy
- Click **"Deployments"** tab
- Click **three dots (⋯)** on latest deployment
- Click **"Redeploy"**
- Wait 2 minutes

---

## ✅ Done!

Your website now uses the new backend!

---

## 🆘 Stuck?

**Q: Which project is my frontend?**
A: The one that's NOT named "backend". It's probably the first one you deployed.

**Q: Where is "Environment Variables"?**
A: Settings tab → Left sidebar → "Environment Variables"

**Q: I don't see "Add New" button**
A: Look at the top right of the Environment Variables page.

**Q: It says the variable already exists**
A: Click on it, then click "Edit", change the value, save.

---

Tell me which step you're on and I'll help! 😊

