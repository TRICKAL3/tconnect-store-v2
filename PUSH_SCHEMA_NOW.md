# 🚀 Push Database Schema - Step by Step

## ✅ Step 1: Add Missing Environment Variables

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these 2 variables:

### Variable 1: ADMIN_PASS
- **Key:** `ADMIN_PASS`
- **Value:** `09090808pP#`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Variable 2: JWT_SECRET
- **Key:** `JWT_SECRET`
- **Value:** `my-secret-jwt-key-12345` (or any random string)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

## ✅ Step 2: Push Database Schema

You have 2 options:

### Option A: Use Prisma (If you can run commands)

**Try this first:**

```powershell
# Make sure you're in the project root
cd "C:\Users\TRICKALHOLDINGS\OneDrive\Desktop\tconnect v2.0"

# Generate Prisma client
npx prisma generate

# Push schema (creates all tables)
npx prisma db push
```

**Note:** This needs the DATABASE_URL. If it fails with connection error, use Option B.

### Option B: Use Vercel SQL Editor (Easier - Recommended)

1. **Go to Vercel Dashboard** → Your Project → **Storage** tab
2. **Click on your database** (the one you just created)
3. **Look for "SQL Editor" or "Query" tab** - click it
4. **Copy the SQL below** and paste it into the editor
5. **Click "Run" or "Execute"**

---

## 📋 SQL to Run (Copy This Entire Block):

```sql
-- Create all tables for TConnect Store

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Product table
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Slide table
CREATE TABLE IF NOT EXISTS "Slide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "image" TEXT NOT NULL,
    "cta" TEXT,
    "ctaLink" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

-- Invoice table
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "customer" TEXT NOT NULL,
    "email" TEXT,
    "serviceType" TEXT,
    "items" TEXT NOT NULL,
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "totalMwk" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Quote table
CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "customer" TEXT NOT NULL,
    "email" TEXT,
    "items" TEXT NOT NULL,
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "totalMwk" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- Rate table
CREATE TABLE IF NOT EXISTS "Rate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- Order table
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "totalMwk" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- OrderItem table
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "metadata" TEXT,
    "giftCardCodes" TEXT,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- PaymentSubmission table
CREATE TABLE IF NOT EXISTS "PaymentSubmission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank',
    "bankName" TEXT NOT NULL DEFAULT 'National Bank of Malawi',
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "transactionId" TEXT,
    "popUrl" TEXT,
    "senderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- TTOrder table
CREATE TABLE IF NOT EXISTS "TTOrder" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "orderType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TTOrder_pkey" PRIMARY KEY ("id")
);

-- Chat table
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'bot',
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- ChatMessage table
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## ✅ Step 3: Redeploy

After pushing the schema:

1. **Go to Deployments** tab
2. **Click the 3 dots (⋯)** on the latest deployment
3. **Click "Redeploy"**
4. **Wait for deployment to complete**

## ✅ Step 4: Test

1. **Visit:** `https://yourdomain.com/api/health`
   - Should show: `{"status":"ok"}`

2. **Try creating a product** in Admin panel
   - Should work now! ✅

---

**Choose Option A or B for Step 2, then let me know when you're done!**

