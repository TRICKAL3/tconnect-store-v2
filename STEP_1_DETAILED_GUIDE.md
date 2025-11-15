# 📱 STEP 1: Update Frontend Backend URL - Super Detailed Guide

## 🎯 What We're Doing
Your website (frontend) needs to know where to find your backend server. Right now it might be pointing to `localhost:4000` which only works on your computer. We need to change it to the new Vercel backend URL.

---

## 📋 Step-by-Step Instructions

### Part 1: Go to Vercel Dashboard

1. **Open your web browser**
2. **Go to:** https://vercel.com/dashboard
3. **Sign in** if you're not already signed in

---

### Part 2: Find Your Frontend Project

1. **Look at the list of projects** on the Vercel dashboard
2. **Find your frontend project** - it might be named:
   - `tconnect-v2-0`
   - `tconnect-store-v2`
   - Or something similar (the one that's NOT "backend")
3. **Click on it** to open the project

---

### Part 3: Go to Environment Variables

1. **Look at the top of the page** - you'll see tabs like:
   - Overview
   - Deployments
   - **Settings** ← Click this one!
   
2. **In the left sidebar** (under Settings), you'll see:
   - General
   - Domains
   - **Environment Variables** ← Click this one!
   - Integrations
   - etc.

3. **Click "Environment Variables"**

---

### Part 4: Add or Edit the Backend URL

Now you'll see a list of environment variables. You need to find or add `REACT_APP_API_BASE`.

#### Option A: If You See `REACT_APP_API_BASE` in the List

1. **Find `REACT_APP_API_BASE`** in the list
2. **Click on it** (or click the three dots next to it)
3. **Click "Edit"**
4. **In the "Value" field**, delete the old value
5. **Type or paste this new value:**
   ```
   https://backend-2c1k13ejq-trickals-projects.vercel.app
   ```
6. **Make sure these are checked:**
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development
7. **Click "Save"**

#### Option B: If You DON'T See `REACT_APP_API_BASE`

1. **Click the "Add New" button** (usually at the top right)
2. **In the "Key" field**, type:
   ```
   REACT_APP_API_BASE
   ```
3. **In the "Value" field**, type or paste:
   ```
   https://backend-2c1k13ejq-trickals-projects.vercel.app
   ```
4. **Under "Environments"**, check all three boxes:
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development
5. **Click "Save"**

---

### Part 5: Redeploy Your Frontend

After saving the environment variable, you MUST redeploy for the change to take effect.

1. **Click the "Deployments" tab** at the top of the page
2. **Look at the list of deployments** - you'll see the most recent one at the top
3. **Find the latest deployment** (it will have a timestamp like "2 minutes ago" or "just now")
4. **Click the three dots (⋯)** on the right side of that deployment
5. **Click "Redeploy"** from the dropdown menu
6. **Wait 1-2 minutes** for the redeployment to finish
7. **You'll see a green checkmark** when it's done

---

## ✅ How to Know It Worked

1. **Visit your frontend website** (your Vercel frontend URL)
2. **Open browser console** (Press F12, then click "Console" tab)
3. **Look for any errors** - if you see errors about `localhost:4000`, it didn't work yet
4. **Try using the website** - sign in, view products, etc.
5. **If everything works**, you're done! ✅

---

## 🆘 Common Issues & Solutions

### Issue: "I can't find my frontend project"
- **Solution:** Look for the project that's NOT named "backend". It might be the one you deployed first.

### Issue: "I don't see Environment Variables option"
- **Solution:** Make sure you clicked on the **Settings** tab first, then look in the left sidebar.

### Issue: "The value won't save"
- **Solution:** Make sure you don't have any extra spaces before or after the URL. Copy it exactly as shown.

### Issue: "I redeployed but it still doesn't work"
- **Solution:** 
  1. Wait a few more minutes (sometimes it takes time)
  2. Clear your browser cache (Ctrl+Shift+Delete)
  3. Try in an incognito/private window
  4. Check the browser console for errors

---

## 📸 What It Should Look Like

**Environment Variables Page:**
```
┌─────────────────────────────────────────┐
│  Environment Variables                   │
│  [Add New]                              │
├─────────────────────────────────────────┤
│  Key                    Value           │
│  REACT_APP_API_BASE    https://...     │
│  REACT_APP_FIREBASE...  AIzaSy...       │
└─────────────────────────────────────────┘
```

**When Adding New:**
```
┌─────────────────────────────────────────┐
│  Add Environment Variable               │
│                                         │
│  Key: [REACT_APP_API_BASE        ]     │
│                                         │
│  Value: [https://backend-2c1k... ]     │
│                                         │
│  Environments:                          │
│  ☑ Production                           │
│  ☑ Preview                              │
│  ☑ Development                          │
│                                         │
│  [Cancel]  [Save]                       │
└─────────────────────────────────────────┘
```

---

## 🎯 Quick Checklist

- [ ] Opened Vercel dashboard
- [ ] Found my frontend project
- [ ] Went to Settings → Environment Variables
- [ ] Added/Edited `REACT_APP_API_BASE`
- [ ] Set value to: `https://backend-2c1k13ejq-trickals-projects.vercel.app`
- [ ] Checked all three environments (Production, Preview, Development)
- [ ] Saved the variable
- [ ] Redeployed the frontend
- [ ] Tested the website

---

## 💡 Still Confused?

Tell me:
1. **Which part are you stuck on?** (Part 1, 2, 3, 4, or 5?)
2. **What do you see on your screen?**
3. **What error message (if any) are you getting?**

I'll help you through it step by step! 😊

