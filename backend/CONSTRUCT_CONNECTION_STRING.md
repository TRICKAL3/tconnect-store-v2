# 🔧 Construct Supabase Connection String Manually

If you can't find the connection string in the dashboard, we can build it manually!

## Step 1: Get Your Database Password

1. Go to: https://supabase.com/dashboard
2. Select your project: **cifqhaamcfqahrpurxpl**
3. Click **Settings** (gear icon ⚙️)
4. Click **Database**
5. Scroll to **"Database password"** section
6. If you see a password, copy it
7. If you don't see it or forgot it, click **"Reset database password"**
8. **Copy the password immediately** (Supabase only shows it once!)

## Step 2: Build the Connection String

Your connection string format is:

### For Direct Connection (Standard):
```
postgresql://postgres:[YOUR-PASSWORD]@db.cifqhaamcfqahrpurxpl.supabase.co:5432/postgres
```

### For Serverless/Vercel (Recommended - Use Connection Pooling):
```
postgresql://postgres.cifqhaamcfqahrpurxpl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Replace `[YOUR-PASSWORD]` with the password you copied in Step 1**

## Step 3: Example

If your password is `MySecurePass123`, your connection string would be:
```
postgresql://postgres.cifqhaamcfqahrpurxpl:MySecurePass123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## ✅ Use This Format

For Vercel (serverless), use the **pooler** version (second one above).

Once you have your password, tell me and I'll help you construct the exact connection string!

