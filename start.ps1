Write-Host "🚀 Starting LittleLoom..." -ForegroundColor Green

# Kill any existing Node processes
taskkill /f /im node.exe 2>$null

# Clear caches
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue

# Set network hostname (update IP if needed)
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.228"

# Start Expo with clean cache and dev client
npx expo start --clear --dev-client --max-workers 1