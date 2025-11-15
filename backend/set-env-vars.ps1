# PowerShell script to set Vercel environment variables
# Run this from the backend directory

Write-Host "Setting environment variables for Vercel backend..." -ForegroundColor Green

# Generate JWT_SECRET reminder
Write-Host "`n⚠️  IMPORTANT: Generate JWT_SECRET at https://randomkeygen.com/" -ForegroundColor Yellow
Write-Host "   Copy a 'CodeIgniter Encryption Keys' (256-bit)" -ForegroundColor Yellow
Write-Host "`nPress Enter after you've generated your JWT_SECRET..." -ForegroundColor Cyan
Read-Host

# Get JWT_SECRET from user
$jwtSecret = Read-Host "Enter your JWT_SECRET"
$adminPass = Read-Host "Enter your ADMIN_PASS (admin password)"

Write-Host "`nAdding environment variables..." -ForegroundColor Green

# Set environment variables
npx vercel env add DATABASE_URL production
Write-Host "Enter: file:./prisma/dev.db" -ForegroundColor Yellow

npx vercel env add ADMIN_PASS production
Write-Host "Enter: $adminPass" -ForegroundColor Yellow

npx vercel env add JWT_SECRET production
Write-Host "Enter: $jwtSecret" -ForegroundColor Yellow

npx vercel env add SUPABASE_URL production
Write-Host "Enter: https://cifqhaamcfqahrpurxpl.supabase.co" -ForegroundColor Yellow

npx vercel env add SUPABASE_KEY production
Write-Host "Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ" -ForegroundColor Yellow

npx vercel env add VERCEL production
Write-Host "Enter: 1" -ForegroundColor Yellow

Write-Host "`n✅ Environment variables added!" -ForegroundColor Green
Write-Host "`nNow redeploy with: npx vercel --prod" -ForegroundColor Cyan

