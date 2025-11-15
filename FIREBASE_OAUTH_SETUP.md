# Firebase OAuth Setup Guide

## Critical: Authorized Redirect URIs

For Google OAuth to work with Firebase, you MUST add these authorized redirect URIs in **BOTH** places:

### 1. Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project: `tconnect-store-9893e`
3. Go to **Authentication** → **Sign-in method** → **Google**
4. Under "Authorized domains", make sure `localhost` is listed
5. Click **Save**

### 2. Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Select project: `tconnect-store-9893e` (or your Firebase project)
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under "Authorized redirect URIs", add:
   - `http://localhost:3000`
   - `http://localhost:3000/`
   - `http://localhost:3000/signin`
   - `http://localhost:3000/signup`
6. Click **Save**

## Testing
After adding the redirect URIs:
1. Clear browser cache/cookies
2. Try signing in with Google
3. Check browser console for logs starting with `🔵`

