# 🚀 Backend Deployment Guide

Your backend needs to be deployed so that your frontend (and other devices) can access it.

## ⚠️ Important Notes

1. **SQLite Database**: Your backend uses SQLite, which works for single-instance deployments
2. **Free Options**: Both Railway and Render offer free tiers
3. **Environment Variables**: You'll need to set these in your hosting platform

## 🎯 Quick Decision Guide

**Choose Railway if:**
- ✅ You want the easiest setup
- ✅ You want automatic deployments from GitHub
- ✅ You want the best free tier experience

**Choose Render if:**
- ✅ You want another free option
- ✅ Railway is not available in your region

## 📋 Required Environment Variables

Before deploying, prepare these values:

```
DATABASE_URL=file:./prisma/dev.db
ADMIN_PASS=your-secure-admin-password-here
JWT_SECRET=your-random-secret-key-here
SUPABASE_URL=https://cifqhaamcfqahrpurxpl.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

**Generate Secrets:**
- For `JWT_SECRET`: Use https://randomkeygen.com/ (use a 256-bit key)
- For `ADMIN_PASS`: Use a strong password you'll remember

## 🚂 Option 1: Deploy to Railway (Recommended)

**See detailed guide:** `backend/DEPLOY_RAILWAY.md`

**Quick Steps:**
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub repo
4. Set Root Directory to `backend`
5. Add environment variables
6. Deploy!
7. Copy the URL (e.g., `https://your-app.up.railway.app`)

## 🎨 Option 2: Deploy to Render

**See detailed guide:** `backend/DEPLOY_RENDER.md`

**Quick Steps:**
1. Go to https://render.com
2. Sign in with GitHub
3. New → Web Service
4. Connect your repo
5. Set Root Directory to `backend`
6. Add environment variables
7. Deploy!
8. Copy the URL (e.g., `https://your-app.onrender.com`)

## ✅ After Deployment

1. **Test your backend:**
   - Visit: `https://your-backend-url.com/health`
   - Should return: `{"status":"ok"}`

2. **Update frontend:**
   - Go to Vercel → Settings → Environment Variables
   - Add: `REACT_APP_API_BASE` = `https://your-backend-url.com`
   - Redeploy frontend

3. **Verify:**
   - Open your Vercel site
   - Check browser console
   - Should see API calls to your backend URL (not localhost)

## 🔧 Troubleshooting

### Backend won't start
- Check deployment logs
- Verify all environment variables are set
- Make sure `Root Directory` is `backend`

### Database errors
- SQLite file is created automatically
- If you need to run migrations, use the platform's console/SSH

### CORS errors
- Backend is configured to allow all origins
- Verify backend URL is correct in frontend

### Can't connect from frontend
- Double-check `REACT_APP_API_BASE` is set in Vercel
- Verify backend URL is accessible (try `/health` endpoint)
- Check browser console for exact error messages

## 📞 Need Help?

Check the detailed guides:
- `backend/DEPLOY_RAILWAY.md` - Railway deployment
- `backend/DEPLOY_RENDER.md` - Render deployment

