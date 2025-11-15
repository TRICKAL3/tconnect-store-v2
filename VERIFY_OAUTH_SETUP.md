# 🔍 How to Verify OAuth Setup is Correct

## Step 1: Check Which OAuth Client Firebase is Using

1. Go to: https://console.firebase.google.com/
2. Select project: **tconnect-store-9893e**
3. Go to **Authentication** → **Sign-in method** → **Google**
4. Look for **"Web SDK configuration"** section
5. You should see:
   - **Web client ID**: `708789106974-xxxxx.apps.googleusercontent.com`
   - **Web client secret**: (hidden)
6. **COPY THE CLIENT ID** - you'll need this!

## Step 2: Find the Correct OAuth Client in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. **CRITICAL**: Select project **tconnect-store-9893e** from the dropdown at the top
3. Look in **OAuth 2.0 Client IDs** section
4. Find the client ID that **MATCHES** the one from Firebase (starts with `708789106974-`)
5. **THIS IS THE ONE YOU NEED TO EDIT** - not any other client!

## Step 3: Verify Redirect URIs

Click on the correct OAuth client and check **Authorized redirect URIs**:

**MUST HAVE THESE EXACT URIs:**
```
http://localhost:3000/__/auth/handler
http://localhost:3000
```

**Common mistakes:**
- ❌ `https://localhost:3000` (wrong - must be `http://`)
- ❌ `http://localhost:3000/` (trailing slash - remove it)
- ❌ `http://localhost:3000/__/auth/handler/` (trailing slash - remove it)
- ❌ Spaces before/after the URI
- ❌ Wrong port (must be 3000)

## Step 4: Verify Authorized Domains in Firebase

1. Go to: https://console.firebase.google.com/
2. Select project: **tconnect-store-9893e**
3. Go to **Authentication** → **Settings** tab
4. Scroll to **Authorized domains**
5. **MUST HAVE**: `localhost`

## Step 5: Test the Configuration

After making changes:

1. **Wait 1-2 minutes** for changes to propagate
2. **Clear browser cache completely** (or use incognito)
3. Go to: `http://localhost:3000/signup`
4. Open browser console (F12)
5. Click "Sign up with Google"
6. After redirect, check console for:
   - ✅ `🔵 [App] getRedirectResult returned: User: your@email.com` = SUCCESS
   - ❌ `🔵 [App] getRedirectResult returned: null` = STILL BROKEN

## 🔴 If Still Not Working

### Check 1: Are you editing the RIGHT OAuth client?
- There might be multiple OAuth clients
- Only edit the one that matches your Firebase Web client ID
- The client ID should start with `708789106974-`

### Check 2: Did you SAVE the changes?
- Changes in Google Cloud Console must be saved
- Look for a "SAVE" button at the bottom

### Check 3: Did you wait for propagation?
- Google Cloud changes can take 1-2 minutes
- Try again after waiting

### Check 4: Are you using the correct browser?
- Clear ALL cookies for localhost
- Or use a completely different browser
- Or use incognito/private mode

### Check 5: Check the exact error in console
- Look for messages starting with `🔵 ❌`
- The console will tell you exactly what's wrong

## 📋 Quick Checklist

- [ ] Found the correct OAuth client (matches Firebase client ID)
- [ ] Added `http://localhost:3000/__/auth/handler` to redirect URIs
- [ ] Added `http://localhost:3000` to redirect URIs
- [ ] No trailing slashes
- [ ] Using `http://` not `https://`
- [ ] Saved changes in Google Cloud Console
- [ ] `localhost` is in Firebase authorized domains
- [ ] Cleared browser cache
- [ ] Waited 1-2 minutes after saving
- [ ] Checked browser console for errors

