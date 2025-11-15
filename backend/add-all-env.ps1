# PowerShell script to add all Vercel environment variables
# Run this from the backend directory

$databaseUrl = "postgresql://postgres.cifqhaamcfqahrpurxpl:uzy8rGeq6zxTp60i@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
$supabaseUrl = "https://cifqhaamcfqahrpurxpl.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ"

Write-Host "Adding environment variables to Vercel..." -ForegroundColor Green
Write-Host ""

# Get admin password
$adminPass = Read-Host "Enter your ADMIN_PASS (admin password)"
if ([string]::IsNullOrWhiteSpace($adminPass)) {
    $adminPass = "YourSecurePassword123!"
    Write-Host "Using default: $adminPass" -ForegroundColor Yellow
}

# Get JWT secret
Write-Host ""
Write-Host "Generate JWT_SECRET at: https://randomkeygen.com/" -ForegroundColor Yellow
Write-Host "Copy a 'CodeIgniter Encryption Keys' (256-bit)" -ForegroundColor Yellow
$jwtSecret = Read-Host "Enter your JWT_SECRET"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    Write-Host "JWT_SECRET is required! Exiting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Adding DATABASE_URL..." -ForegroundColor Cyan
echo $databaseUrl | npx vercel env add DATABASE_URL production

Write-Host ""
Write-Host "Adding ADMIN_PASS..." -ForegroundColor Cyan
echo $adminPass | npx vercel env add ADMIN_PASS production

Write-Host ""
Write-Host "Adding JWT_SECRET..." -ForegroundColor Cyan
echo $jwtSecret | npx vercel env add JWT_SECRET production

Write-Host ""
Write-Host "Adding SUPABASE_URL..." -ForegroundColor Cyan
echo $supabaseUrl | npx vercel env add SUPABASE_URL production

Write-Host ""
Write-Host "Adding SUPABASE_KEY..." -ForegroundColor Cyan
echo $supabaseKey | npx vercel env add SUPABASE_KEY production

Write-Host ""
Write-Host "Adding VERCEL..." -ForegroundColor Cyan
echo "1" | npx vercel env add VERCEL production

Write-Host ""
Write-Host "✅ All environment variables added!" -ForegroundColor Green
Write-Host ""
Write-Host "Now redeploy with: npx vercel --prod" -ForegroundColor Cyan

