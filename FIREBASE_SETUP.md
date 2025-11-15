# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for TConnect with custom domain support.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name: "TConnect" (or your preferred name)
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Click on **Sign-in method** tab
3. Enable the following providers:
   - **Email/Password** - Click, enable, and save
   - **Google** - Click, enable, and save
     - You'll need to provide:
       - Project support email
       - Authorized domains (add your domain: `tconnect.store` or `localhost` for development)

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click on the **Web** icon (`</>`)
4. Register your app:
   - App nickname: "TConnect Web"
   - Check "Also set up Firebase Hosting" if you want (optional)
   - Click "Register app"
5. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

Create a `.env` file in the project root (if it doesn't exist) and add:

```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

Replace the values with your actual Firebase configuration values.

## Step 5: Configure Custom Domain (Optional but Recommended)

To show "continue to TConnect" instead of Firebase domain:

1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your custom domain (e.g., `tconnect.store`)
3. Configure your domain's DNS:
   - Add a CNAME record pointing to Firebase
   - Or use Firebase Hosting with custom domain

## Step 6: Configure Google OAuth in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click to edit it
6. Add authorized redirect URIs:
   - For Firebase Auth: `https://YOUR-PROJECT-ID.firebaseapp.com/__/auth/handler`
   - For your custom domain: `https://tconnect.store/__/auth/handler` (if using custom domain)
7. In **OAuth consent screen**:
   - App name: **TConnect**
   - User support email: Your email
   - Application home page: `https://tconnect.store` (or your domain)
   - Privacy policy link: `https://tconnect.store/privacy`
   - Terms of service link: `https://tconnect.store/terms`
   - Authorized domains: Add `tconnect.store` (or your domain)

## Step 7: Configure Email Templates

1. In Firebase Console, go to **Authentication** → **Settings** → **Email templates**
2. Customize email templates:
   - **Email address verification**: Brand as "TConnect"
   - **Password reset**: Brand as "TConnect"
3. Update the sender name to "TConnect"

## Step 8: Test the Setup

1. Start your development server: `npm start`
2. Try signing up with email/password
3. Try signing in with Google
4. Verify that emails are branded as "TConnect"
5. Check that Google OAuth shows "continue to TConnect" (if custom domain is configured)

## Notes

- Firebase Auth supports custom domains on the free tier
- The OAuth consent screen will show your custom domain if configured
- Email templates can be customized in Firebase Console
- All authentication flows (email, Google, password reset) are now handled by Firebase

## Troubleshooting

- **"Invalid API key"**: Check your `.env` file has correct values
- **OAuth not working**: Verify Google OAuth is enabled in Firebase and Google Cloud Console
- **Custom domain not showing**: Ensure DNS is properly configured and domain is added to authorized domains
- **Emails not sending**: Check Firebase project billing (free tier has limits)

