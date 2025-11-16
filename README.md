# TConnect Store v2.0

## Quick Setup

### 1. Connect to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/tconnect-store-v2.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import from GitHub
4. Select your repository
5. Configure:
   - **Root Directory:** `./` (root)
   - **Framework:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

### 3. Backend Deployment

The backend is in the `backend/` folder. Deploy it separately:

1. In Vercel, create a new project
2. Same GitHub repo
3. **Root Directory:** `backend`
4. **Framework:** Other
5. Add environment variables (see backend/.env.example)

## Environment Variables

### Frontend (Vercel)
- `REACT_APP_API_BASE` (optional - code has fallback)

### Backend (Vercel)
- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_PASS` - Admin password
- `JWT_SECRET` - JWT secret key
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_KEY` - Supabase key
- `VERCEL=1`

## Current Backend URL

`https://backend-1zlnbxr38-trickals-projects.vercel.app`

Update in `src/lib/getApiBase.ts` if backend is redeployed.
