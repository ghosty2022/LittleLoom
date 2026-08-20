# ============================================================
# PowerShell Script to add user to LittleLoom Registry
# ============================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  LittleLoom - Add User to Registry" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# User details
$USER_ID = "de28d446-650b-410a-b04a-7d8bf9a729f7"
$EMAIL = "ondiekiisaac7@gmail.com"
$FULL_NAME = "Ondieki"
$USERNAME = "babat"
$PHONE = "+254722211129"

Write-Host "User Details:" -ForegroundColor Yellow
Write-Host "  User ID: $USER_ID"
Write-Host "  Email: $EMAIL"
Write-Host "  Full Name: $FULL_NAME"
Write-Host "  Username: $USERNAME"
Write-Host "  Phone: $PHONE"
Write-Host ""

# Check if node_modules exists
$NODE_MODULES = "./node_modules"
if (-not (Test-Path $NODE_MODULES)) {
    Write-Host "❌ node_modules not found. Please run 'npm install' first." -ForegroundColor Red
    exit 1
}

# Create a temporary Node.js script to update AsyncStorage
$TEMP_SCRIPT = @"
const { default: AsyncStorage } = require('@react-native-async-storage/async-storage');

// Mock AsyncStorage for Node.js environment
if (!global.AsyncStorage) {
  global.AsyncStorage = {
    _data: {},
    getItem: async (key) => {
      return global.AsyncStorage._data[key] || null;
    },
    setItem: async (key, value) => {
      global.AsyncStorage._data[key] = value;
      return true;
    },
    multiRemove: async (keys) => {
      keys.forEach(key => {
        delete global.AsyncStorage._data[key];
      });
      return true;
    }
  };
}

// Also set it for the require
global.__AsyncStorage = global.AsyncStorage;

async function addUserToRegistry() {
  const USER_REGISTRY_KEY = 'littleloom_user_registry';
  
  try {
    // Read existing registry
    let registry = {};
    const existing = await AsyncStorage.getItem(USER_REGISTRY_KEY);
    if (existing) {
      registry = JSON.parse(existing);
      console.log('📚 Existing registry found with entries:', Object.keys(registry).length);
    } else {
      console.log('📚 No existing registry found, creating new one.');
    }
    
    // Add user to registry
    registry['$USER_ID'] = {
      userId: '$USER_ID',
      email: '$EMAIL',
      fullName: '$FULL_NAME',
      avatar: '👤',
      role: 'parent1',
      createdAt: new Date().toISOString(),
      communityUsername: '$USERNAME',
      communityHandle: '@$USERNAME',
      communityBio: '',
      communityAvatar: '👤',
      communityDisplayName: '$FULL_NAME',
      communityStats: { posts: 0, followers: 0, following: 0, helpful: 0 },
      communitySelectedTopics: [],
      socialProvider: null,
      hasPassword: true,
      phoneNumber: '$PHONE'
    };
    
    // Also add username to username registry
    const USERNAME_REGISTRY_KEY = 'littleloom_username_registry';
    let usernameRegistry = {};
    const existingUsername = await AsyncStorage.getItem(USERNAME_REGISTRY_KEY);
    if (existingUsername) {
      usernameRegistry = JSON.parse(existingUsername);
    }
    usernameRegistry['$USERNAME'] = '$USER_ID';
    
    // Save both registries
    await AsyncStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(registry));
    await AsyncStorage.setItem(USERNAME_REGISTRY_KEY, JSON.stringify(usernameRegistry));
    
    console.log('');
    console.log('✅ User added to registry successfully!');
    console.log('');
    console.log('Registry details:');
    console.log(`  User ID: ${registry['$USER_ID'].userId}`);
    console.log(`  Email: ${registry['$USER_ID'].email}`);
    console.log(`  Username: ${registry['$USER_ID'].communityUsername}`);
    console.log(`  Phone: ${registry['$USER_ID'].phoneNumber}`);
    console.log('');
    console.log('You can now sign in with:');
    console.log(`  📧 Email: $EMAIL`);
    console.log(`  👤 Username: $USERNAME or @$USERNAME`);
    console.log(`  📱 Phone: $PHONE or 0722211129`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error adding user to registry:', error);
    process.exit(1);
  }
}

// Run the function
addUserToRegistry();
"@

# Save temp script
$TEMP_SCRIPT_PATH = [System.IO.Path]::GetTempFileName() + ".js"
$TEMP_SCRIPT | Out-File -FilePath $TEMP_SCRIPT_PATH -Encoding UTF8

Write-Host "📝 Running script to add user to registry..." -ForegroundColor Yellow
Write-Host ""

# Run the script
try {
    $result = node $TEMP_SCRIPT_PATH 2>&1
    Write-Host $result
} catch {
    Write-Host "❌ Error running Node.js script: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running this command manually:" -ForegroundColor Yellow
    Write-Host "node -e `"$TEMP_SCRIPT`""
}

# Clean up
Remove-Item $TEMP_SCRIPT_PATH -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  To verify, you can also run this SQL in Supabase:" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "SELECT * FROM auth.users WHERE id = '$USER_ID';"
Write-Host "========================================================" -ForegroundColor Cyan