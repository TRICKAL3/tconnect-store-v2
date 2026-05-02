-- Run this once in PostgreSQL (pgAdmin / Supabase / Neon / psql SQL editor).
-- Use the SAME database as DATABASE_URL for your API.

-- One saved cart row per app user (cleared after checkout).

CREATE TABLE IF NOT EXISTS public.user_cart_snapshots (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  items_json TEXT NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link to existing users table. Prisma model "User" is usually table "User" (quoted).
-- If this line errors with "relation User does not exist", your DB may use lowercase "users"
-- instead; change REFERENCES "User"(id) to REFERENCES public.users(id) (match your schema).
ALTER TABLE public.user_cart_snapshots
  DROP CONSTRAINT IF EXISTS user_cart_snapshots_user_id_fkey;

ALTER TABLE public.user_cart_snapshots
  ADD CONSTRAINT user_cart_snapshots_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public."User"(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
