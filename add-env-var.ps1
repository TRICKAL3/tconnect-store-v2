# PowerShell script to add REACT_APP_API_BASE environment variable
# Run this from the project root

$backendUrl = "https://backend-72zfcspmp-trickals-projects.vercel.app"

Write-Host "Adding REACT_APP_API_BASE for all environments..."
Write-Host "Backend URL: $backendUrl"
Write-Host ""
Write-Host "You'll be prompted 3 times (Production, Preview, Development)"
Write-Host "For each prompt, just press Enter to use the default value"
Write-Host ""

# Add for Production
Write-Host "Adding for Production..."
echo $backendUrl | npx vercel env add REACT_APP_API_BASE production

# Add for Preview  
Write-Host "Adding for Preview..."
echo $backendUrl | npx vercel env add REACT_APP_API_BASE preview

# Add for Development
Write-Host "Adding for Development..."
echo $backendUrl | npx vercel env add REACT_APP_API_BASE development

Write-Host ""
Write-Host "Done! Now redeploy:"
Write-Host "npx vercel --prod --yes"

