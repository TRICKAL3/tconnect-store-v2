# 🔴 Firebase Unauthorized Domain - Detailed Troubleshooting

## ⚠️ Common Mistakes

1. **Adding domain WITH `https://`** ❌
   - Wrong: `https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`
   - Correct: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

2. **Adding domain WITH trailing slash** ❌
   - Wrong: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app/`
   - Correct: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

3. **Using wrong Vercel URL** ❌
   - Check your actual Vercel deployment URL

## ✅ Step-by-Step Fix

### Step 1: Get Your EXACT Vercel Domain

1. Go to **https://vercel.com**
2. Click on your project
3. Look at the **Domains** section
4. Copy the EXACT domain (should look like: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`)
   - **NO** `https://`
   - **NO** trailing `/`
   - Just the domain name

### Step 2: Add Domain to Firebase (EXACT STEPS)

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/
   - Select project: **tconnect-store-9893e**

2. **Click "Authentication"** (left sidebar)

3. **Click "Settings" tab** (top of the page)

4. **Scroll down to "Authorized domains"** section

5. **Click "Add domain"** button

6. **Enter ONLY the domain name** (example):
   ```
   tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app
   ```
   - ❌ DO NOT include `https://`
   - ❌ DO NOT include trailing `/`
   - ✅ Just the domain name

7. **Click "Add"**

8. **Verify it appears in the list** - it should show:
   - `localhost`
   - `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`
   - (and any other domains you added)

### Step 3: Verify Domain Format

The domain in Firebase should look EXACTLY like this:
```
tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app
```

**NOT:**
- ❌ `https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`
- ❌ `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app/`
- ❌ `http://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

### Step 4: Check if You're Using a Different URL

Vercel might be using a different URL. Check:

1. Go to **Vercel Dashboard** → Your Project
2. Look at the **Domains** section
3. You might see:
   - Production URL: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`
   - Preview URL: `tconnect-v2-0-git-main-trickals-projects.vercel.app`
   - Custom domain: `yourdomain.com`

**Add ALL domains you're using!**

### Step 5: Clear Browser Cache

1. **Hard refresh** your browser:
   - Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **Or clear cache completely:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Select "Cached images and files"
   - Clear data

### Step 6: Wait for Propagation

Firebase changes can take **1-5 minutes** to propagate. Wait a few minutes and try again.

### Step 7: Test Again

1. Visit your Vercel URL
2. Open browser console (F12)
3. Try signing in with Google
4. Check for any error messages

## 🔍 Still Not Working?

### Check 1: Verify Domain is Actually Added

1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. **Take a screenshot** and verify your domain is there
4. Make sure there are NO extra characters

### Check 2: Check Browser Console

1. Open your Vercel site
2. Press F12 to open console
3. Try signing in
4. Look for the exact error message
5. It should show which domain is unauthorized

### Check 3: Verify You're on the Right Project

Make sure you're adding the domain to:
- **Project:** `tconnect-store-9893e`
- **NOT** a different Firebase project

### Check 4: Check Vercel URL

The URL you're visiting must match the domain you added. If you're visiting:
- `https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

Then you must add:
- `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

## 📝 Quick Checklist

- [ ] Got the EXACT domain from Vercel dashboard
- [ ] Added domain WITHOUT `https://`
- [ ] Added domain WITHOUT trailing `/`
- [ ] Domain appears in Firebase Authorized domains list
- [ ] Waited 2-5 minutes after adding
- [ ] Cleared browser cache
- [ ] Tried in incognito/private window
- [ ] Verified you're on the correct Firebase project

## 🆘 If Still Not Working

Share:
1. The EXACT domain you added to Firebase (screenshot if possible)
2. The EXACT URL you're visiting
3. The EXACT error message from browser console
4. A screenshot of Firebase Authorized domains list

