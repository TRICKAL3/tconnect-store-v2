# 🎉 UNIFIED BACKEND + FRONTEND SETUP

## ✅ What Changed

**Everything is now in ONE project!** No more separate backend/frontend URLs, no more CORS issues!

- ✅ Backend API routes moved to `/api` folder
- ✅ Frontend uses `/api` (same domain - no CORS!)
- ✅ Single deployment to Vercel
- ✅ Same database (PostgreSQL/Supabase)

## 📁 New Structure

```
tconnect v2.0/
├── api/                    # Backend API (serverless functions)
│   ├── [...path].ts       # Main API handler
│   ├── lib/               # Shared utilities
│   │   ├── prisma.ts
│   │   ├── adminAuth.ts
│   │   └── auth.ts
│   └── routes/            # API routes
│       ├── products.ts
│       ├── orders.ts
│       ├── users.ts
│       └── ... (all routes)
├── prisma/
│   └── schema.prisma      # Database schema
├── src/                    # Frontend React app
└── package.json           # All dependencies in one place
```

## 🚀 Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

This will:
- Install all frontend + backend dependencies
- Run `prisma generate` automatically (postinstall script)

### 2. Set Up Database

You need a PostgreSQL database. Options:

**Option A: Supabase (Recommended - you already have this)**
1. Go to https://supabase.com
2. Get your connection string
3. Add to Vercel environment variables: `DATABASE_URL`

**Option B: Vercel Postgres (New)**
1. Go to Vercel Dashboard → Your Project → Storage
2. Create Postgres database
3. Connection string is auto-added to environment variables

### 3. Push Database Schema

```bash
npx prisma db push
```

Or if that doesn't work (connection issues), use Supabase SQL Editor:
1. Go to Supabase → SQL Editor
2. Copy the SQL from `backend/CREATE_TABLES.sql` (if it exists)
3. Run it

### 4. Add Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:

```
DATABASE_URL=postgresql://... (your Supabase/Vercel Postgres connection string)
ADMIN_PASS=09090808pP# (your admin password)
JWT_SECRET=your-secret-key-here (any random string)
```

### 5. Deploy to Vercel

```bash
git add .
git commit -m "Unified backend + frontend setup"
git push
```

Vercel will automatically:
- Build the React frontend
- Set up API routes as serverless functions
- Deploy everything together

## 🎯 How It Works

### In Production:
- Frontend: `https://yourdomain.com`
- API: `https://yourdomain.com/api/products`
- **Same domain = No CORS issues!**

### In Development:
- Frontend: `http://localhost:3000` (React dev server)
- API: `http://localhost:4000` (if you run backend separately)
- OR: Use `/api` and run Vercel dev: `vercel dev`

## 🔧 Local Development

### Option 1: Run Everything Together (Recommended)

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Run in development mode
vercel dev
```

This runs both frontend and API together.

### Option 2: Run Separately

**Terminal 1 - Frontend:**
```bash
npm start
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

## ✅ Testing

After deployment:

1. **Test API directly:**
   - Visit: `https://yourdomain.com/api/health`
   - Should return: `{"status":"ok"}`

2. **Test Frontend:**
   - Visit: `https://yourdomain.com`
   - Try creating a product (should work!)

3. **Check Console:**
   - Open browser DevTools
   - Network tab should show requests to `/api/...`
   - No CORS errors!

## 🐛 Troubleshooting

### "Cannot GET /api/products"
- Make sure `api/[...path].ts` exists
- Check Vercel deployment logs
- Ensure `@vercel/node` is installed

### Database Connection Errors
- Check `DATABASE_URL` in Vercel environment variables
- Make sure database is accessible (not blocked by firewall)
- Try `npx prisma db push` locally to test connection

### Prisma Client Not Generated
- Run: `npx prisma generate`
- Check `postinstall` script in `package.json`

## 🎉 Benefits

✅ **No more CORS issues** - Same domain!
✅ **No more URL problems** - Relative paths!
✅ **Simpler deployment** - One project!
✅ **Easier debugging** - Everything together!
✅ **Cost effective** - One Vercel project!

---

**You're all set!** Deploy and test. Everything should work now! 🚀

