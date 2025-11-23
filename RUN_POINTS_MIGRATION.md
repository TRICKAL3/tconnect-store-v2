# Run Points System Database Migration

## ⚠️ IMPORTANT: Database Migration Required

The points system has been implemented, but you need to run a database migration to add the new columns and table.

## Option 1: Run SQL Directly (Recommended for Production)

1. Go to your database provider (e.g., Supabase, Vercel Postgres, etc.)
2. Open the SQL Editor
3. Copy and paste the contents of `prisma/migrations/add_points_system.sql`
4. Run the SQL script

## Option 2: Use Prisma Migrate (If you have access)

```bash
npx prisma migrate dev --name add_points_system
```

Or for production:
```bash
npx prisma migrate deploy
```

## What the Migration Does

1. Adds `pointsBalance` column to `User` table (default: 0)
2. Creates `PointsTransaction` table to track all points activity
3. Adds foreign key constraints
4. Creates indexes for performance

## After Running Migration

1. The error will be resolved
2. Users will start earning points on approved orders
3. Points portal in admin will work
4. Checkout points redemption will work

## Verify Migration

After running, you can verify by checking:
- `User` table has `pointsBalance` column
- `PointsTransaction` table exists

