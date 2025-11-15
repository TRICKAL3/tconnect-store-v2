# Push Prisma schema to Supabase PostgreSQL
$env:DATABASE_URL = "postgresql://postgres.cifqhaamcfqahrpurxpl:uzy8rGeq6zxTp60i@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

Write-Host "Pushing Prisma schema to Supabase..." -ForegroundColor Green
npx prisma db push

Write-Host ""
Write-Host "Generating Prisma client..." -ForegroundColor Green
npx prisma generate

Write-Host ""
Write-Host "✅ Database schema pushed!" -ForegroundColor Green

