# Fix Firebase Unauthorized Domain Error

## Problem
`Firebase: Error (auth/unauthorized-domain)` - Your Vercel domain is not authorized in Firebase.

## Solution: Add Vercel Domain to Firebase

### Step 1: Get Your Vercel Domain
Your deployed domain is: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`

(If you have a custom domain, use that instead)

### Step 2: Add Domain to Firebase

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/
   - Select project: **tconnect-store-9893e**

2. **Navigate to Authentication Settings:**
   - Click **Authentication** (left menu)
   - Click **Settings** tab
   - Scroll down to **Authorized domains** section

3. **Add Your Vercel Domain:**
   - Click **Add domain** button
   - Enter: `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app`
   - Click **Add**
   - **IMPORTANT**: Also add your custom domain if you have one (e.g., `yourdomain.com`)

4. **Verify These Domains Are Listed:**
   - ✅ `localhost` (for local development)
   - ✅ `tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app` (your Vercel domain)
   - ✅ Any custom domain you're using

### Step 3: Update Google Cloud Console (If Using OAuth)

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select project: **tconnect-store-9893e**

2. **Navigate to OAuth Credentials:**
   - Click **APIs & Services** → **Credentials**
   - Find **OAuth 2.0 Client IDs**
   - Click on the **Web client** (the one Firebase created)

3. **Add Authorized Redirect URIs:**
   - Scroll to **Authorized redirect URIs**
   - Add these URIs (one per line, each on its own line):
     ```
     https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app/__/auth/handler
     
     https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app
     ```
   - **IMPORTANT**: 
     - Use `https://` (not `http://`) for Vercel
     - No trailing slashes
     - No spaces
     - Each URI must be on a separate line
   - Click **SAVE**

### Step 4: Test

1. Wait 1-2 minutes for changes to propagate
2. Visit your Vercel URL: https://tconnect-v2-0-1hmgygsx4-trickals-projects.vercel.app
3. Try signing in with Google
4. The error should be gone!

## If You Have a Custom Domain

If you're using a custom domain (e.g., `tconnect.store`):

1. Add the custom domain to Firebase Authorized domains
2. Add redirect URIs in Google Cloud Console (each on its own line):
   ```
   https://tconnect.store/__/auth/handler
   
   https://tconnect.store
   ```
3. Make sure your custom domain is properly configured in Vercel

## Quick Checklist

- [ ] Added Vercel domain to Firebase Authorized domains
- [ ] Added redirect URIs to Google Cloud Console OAuth client
- [ ] Used `https://` (not `http://`) for Vercel URLs
- [ ] No trailing slashes in URIs
- [ ] Waited 1-2 minutes for propagation
- [ ] Tested sign-in on deployed site

