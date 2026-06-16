# find-missing-imports.ps1
# Scans all .tsx files and reports missing imports
# Run: .\find-missing-imports.ps1

$reactNativeComponents = @(
    'ActivityIndicator', 'Button', 'Dimensions', 'FlatList', 'Image', 'ImageBackground',
    'KeyboardAvoidingView', 'Linking', 'Modal', 'Platform', 'Pressable', 'RefreshControl',
    'SafeAreaView', 'ScrollView', 'SectionList', 'Share', 'StatusBar', 'StyleSheet',
    'Switch', 'Text', 'TextInput', 'TouchableHighlight', 'TouchableOpacity', 'TouchableWithoutFeedback',
    'View', 'VirtualizedList', 'Animated', 'Alert', 'ToastAndroid', 'ActionSheetIOS',
    'PermissionsAndroid', 'Settings', 'NativeModules', 'NativeEventEmitter',
    'BackHandler', 'AppRegistry', 'AppState', 'Clipboard', 'DevSettings',
    'DrawerLayoutAndroid', 'DynamicColorIOS', 'InputAccessoryView', 'Keyboard',
    'LogBox', 'PanResponder', 'PixelRatio', 'Appearance', 'ColorPropType',
    'EdgeInsetsPropType', 'PointPropType', 'ViewPropTypes', 'InteractionManager',
    'LayoutAnimation', 'Systrace', 'TimePickerAndroid', 'TVEventHandler',
    'UIManager', ' unstable_batchedUpdates', 'useColorScheme', 'useWindowDimensions',
    'useSafeAreaInsets', 'GestureHandlerRootView'
)

$expoComponents = @(
    'BlurView', 'CameraView', 'CameraType', 'FlashMode', 'VideoView', 'useVideoPlayer',
    'LinearGradient', 'BarCodeScanner', 'Calendar', 'Contacts', 'DocumentPicker',
    'FileSystem', 'Haptics', 'ImageManipulator', 'ImagePicker', 'LocalAuthentication',
    'Location', 'MediaLibrary', 'Notifications', 'ScreenCapture', 'SecureStore',
    'Sharing', 'SplashScreen', 'SQLite', 'StoreReview', 'TaskManager', 'Updates',
    'WebBrowser', 'Audio', 'Video', 'AVPlaybackStatus', 'ScreenOrientation',
    'Brightness', 'Clipboard', 'Crypto', 'Font', 'KeepAwake', 'MailComposer',
    'Network', 'Pedometer', 'Permissions', 'Print', 'SMS', 'Speech', 'StatusBar',
    'SymbolView', 'SystemUI', 'TrackingTransparency', 'VideoThumbnail',
    'AppleAuthentication', 'Facebook', 'GoogleSignIn', 'AdMob', 'Amplitude',
    'Segment', 'Sentry', 'Stripe', 'AuthSession', 'Random', 'Sensor',
    'Accelerometer', 'Barometer', 'Gyroscope', 'Magnetometer', 'Pedometer'
)

$reactNavigationComponents = @(
    'NavigationContainer', 'useNavigation', 'useRoute', 'useFocusEffect',
    'useIsFocused', 'useScrollToTop', 'createNativeStackNavigator',
    'createBottomTabNavigator', 'createDrawerNavigator', 'createStackNavigator',
    'CommonActions', 'StackActions', 'DrawerActions', 'TabActions'
)

$reanimatedComponents = @(
    'FadeIn', 'FadeInUp', 'FadeInDown', 'FadeInLeft', 'FadeInRight',
    'FadeOut', 'FadeOutUp', 'FadeOutDown', 'FadeOutLeft', 'FadeOutRight',
    'SlideInLeft', 'SlideInRight', 'SlideInUp', 'SlideInDown',
    'SlideOutLeft', 'SlideOutRight', 'SlideOutUp', 'SlideOutDown',
    'ZoomIn', 'ZoomOut', 'FlipInX', 'FlipInY', 'FlipOutX', 'FlipOutY',
    'BounceIn', 'BounceOut', 'LightSpeedInLeft', 'LightSpeedOutLeft',
    'PinwheelIn', 'PinwheelOut', 'RollInLeft', 'RollOutLeft',
    'RotateInDownLeft', 'RotateOutDownLeft', 'StretchInX', 'StretchOutX',
    'useSharedValue', 'useAnimatedStyle', 'useAnimatedReaction', 'useAnimatedProps',
    'useAnimatedScrollHandler', 'useAnimatedRef', 'useDerivedValue',
    'useAnimatedGestureHandler', 'useWorkletCallback', 'useFrameCallback',
    'withSpring', 'withTiming', 'withDecay', 'withDelay', 'withRepeat',
    'withSequence', 'withClamp', 'cancelAnimation', 'runOnJS', 'runOnUI',
    'interpolate', 'interpolateColor', 'Extrapolation', 'Easing',
    'Layout', 'EntryExitTransition', 'LinearTransition', 'SequencedTransition',
    'FadingTransition', 'JumpingTransition', 'CurvedTransition',
    'measure', 'scrollTo', 'createAnimatedPropAdapter',
    'SensorType', 'useAnimatedSensor', 'useReducedMotion'
)

$commonContextHooks = @(
    'useApp', 'useAuth', 'useUser', 'useCommunity', 'useCustomization',
    'useBaby', 'useTracker', 'useGallery', 'useFamily', 'useSettings',
    'useTheme', 'useNavigation', 'useRoute', 'useSafeAreaInsets',
    'useColorScheme', 'useWindowDimensions'
)

$commonComponents = @(
    'SafeAvatar', 'SweetAlert', 'showAlert', 'showToast', 'showError',
    'AutoHideScrollView', 'AutoHideFlatList', 'GlassmorphismCard',
    'CircularProgress', 'LoadingSpinner', 'EmptyState', 'ErrorBoundary'
)

$allKnownImports = $reactNativeComponents + $expoComponents + $reactNavigationComponents + 
                   $reanimatedComponents + $commonContextHooks + $commonComponents

$files = Get-ChildItem -Path "src\screens" -Recurse -Include *.tsx
$totalFiles = 0
$filesWithIssues = 0

foreach ($file in $files) {
    $totalFiles++
    $content = Get-Content $file.FullName -Raw
    $lines = Get-Content $file.FullName

    # Skip if no JSX (not a component file)
    if ($content -notmatch "return\s*\(") { continue }

    # Extract all import statements
    $importedItems = @()
    $importMatches = [regex]::Matches($content, "import\s+.*?\s+from\s+['`"](.+?)['`"]")
    foreach ($match in $importMatches) {
        $importLine = $match.Value
        # Extract items between braces
        $braceMatch = [regex]::Match($importLine, "\{([^}]+)\}")
        if ($braceMatch.Success) {
            $items = $braceMatch.Groups[1].Value -split ',' | ForEach-Object { $_.Trim() }
            $importedItems += $items
        }
        # Extract default imports (e.g., import React from 'react')
        $defaultMatch = [regex]::Match($importLine, "import\s+(\w+)\s+from")
        if ($defaultMatch.Success) {
            $importedItems += $defaultMatch.Groups[1].Value
        }
        # Extract wildcard imports (e.g., import * as Haptics from 'expo-haptics')
        $wildcardMatch = [regex]::Match($importLine, "import\s+\*\s+as\s+(\w+)")
        if ($wildcardMatch.Success) {
            $importedItems += $wildcardMatch.Groups[1].Value
        }
    }

    # Also check for require() patterns
    $requireMatches = [regex]::Matches($content, "require\(['`"](.+?)['`"]\)")
    foreach ($match in $requireMatches) {
        $path = $match.Groups[1].Value
        $name = Split-Path $path -Leaf
        $importedItems += $name
    }

    # Clean up imported items (remove 'type' keyword, aliases, etc.)
    $cleanImports = @()
    foreach ($item in $importedItems) {
        $item = $item -replace "^type\s+", "" -replace "\s+as\s+.*", "" -replace "\s+", ""
        if ($item -and $item -notmatch "^[\{\}]" -and $item -ne "from") {
            $cleanImports += $item
        }
    }
    $cleanImports = $cleanImports | Select-Object -Unique

    # Find used items that look like components/constants
    $missingItems = @()

    # Pattern 1: JSX tags like <ComponentName ...>
    $jsxMatches = [regex]::Matches($content, "<(\w+)")
    foreach ($match in $jsxMatches) {
        $name = $match.Groups[1].Value
        if ($name -cmatch "^[A-Z]" -and $name -ne 'React' -and 
            $name -notin $cleanImports -and $name -in $allKnownImports) {
            $missingItems += $name
        }
    }

    # Pattern 2: Function calls like SomeFunction(...)
    $funcMatches = [regex]::Matches($content, "(\w+)\s*\(")
    foreach ($match in $funcMatches) {
        $name = $match.Groups[1].Value
        if ($name -cmatch "^[A-Z]" -and $name -ne 'React' -and 
            $name -notin $cleanImports -and $name -in $allKnownImports -and
            $name -notin $missingItems) {
            $missingItems += $name
        }
    }

    # Pattern 3: Property access like SomeObject.property
    $propMatches = [regex]::Matches($content, "(\w+)\.\w+")
    foreach ($match in $propMatches) {
        $name = $match.Groups[1].Value
        if ($name -cmatch "^[A-Z]" -and $name -ne 'React' -and 
            $name -notin $cleanImports -and $name -in $allKnownImports -and
            $name -notin $missingItems) {
            $missingItems += $name
        }
    }

    # Pattern 4: Specific known missing patterns
    $specificPatterns = @(
        @{ Pattern = "StyleSheet\."; Name = "StyleSheet" },
        @{ Pattern = "Dimensions\."; Name = "Dimensions" },
        @{ Pattern = "Platform\."; Name = "Platform" },
        @{ Pattern = "StatusBar\."; Name = "StatusBar" },
        @{ Pattern = "Animated\."; Name = "Animated" },
        @{ Pattern = "Linking\."; Name = "Linking" },
        @{ Pattern = "Share\."; Name = "Share" },
        @{ Pattern = "Haptics\."; Name = "Haptics" },
        @{ Pattern = "Easing\."; Name = "Easing" },
        @{ Pattern = "Extrapolation\."; Name = "Extrapolation" },
        @{ Pattern = "useSharedValue"; Name = "useSharedValue" },
        @{ Pattern = "useAnimatedStyle"; Name = "useAnimatedStyle" },
        @{ Pattern = "useAnimatedReaction"; Name = "useAnimatedReaction" },
        @{ Pattern = "useAnimatedScrollHandler"; Name = "useAnimatedScrollHandler" },
        @{ Pattern = "runOnJS"; Name = "runOnJS" },
        @{ Pattern = "withSpring"; Name = "withSpring" },
        @{ Pattern = "withTiming"; Name = "withTiming" },
        @{ Pattern = "withRepeat"; Name = "withRepeat" },
        @{ Pattern = "withSequence"; Name = "withSequence" },
        @{ Pattern = "interpolateColor"; Name = "interpolateColor" },
        @{ Pattern = "interpolate\("; Name = "interpolate" },
        @{ Pattern = "FadeInUp"; Name = "FadeInUp" },
        @{ Pattern = "FadeIn"; Name = "FadeIn" },
        @{ Pattern = "FadeOut"; Name = "FadeOut" },
        @{ Pattern = "Layout"; Name = "Layout" },
        @{ Pattern = "SlideInDown"; Name = "SlideInDown" },
        @{ Pattern = "SlideOutUp"; Name = "SlideOutUp" },
        @{ Pattern = "BlurView"; Name = "BlurView" },
        @{ Pattern = "LinearGradient"; Name = "LinearGradient" },
        @{ Pattern = "Ionicons"; Name = "Ionicons" },
        @{ Pattern = "useVideoPlayer"; Name = "useVideoPlayer" },
        @{ Pattern = "VideoView"; Name = "VideoView" },
        @{ Pattern = "useSafeAreaInsets"; Name = "useSafeAreaInsets" },
        @{ Pattern = "GestureHandlerRootView"; Name = "GestureHandlerRootView" },
        @{ Pattern = "useColorScheme"; Name = "useColorScheme" },
        @{ Pattern = "useWindowDimensions"; Name = "useWindowDimensions" },
        @{ Pattern = "SafeAvatar"; Name = "SafeAvatar" },
        @{ Pattern = "showAlert"; Name = "showAlert" },
        @{ Pattern = "showToast"; Name = "showToast" },
        @{ Pattern = "showError"; Name = "showError" },
        @{ Pattern = "AutoHideScrollView"; Name = "AutoHideScrollView" },
        @{ Pattern = "AutoHideFlatList"; Name = "AutoHideFlatList" }
    )

    foreach ($sp in $specificPatterns) {
        if ($content -match $sp.Pattern -and $sp.Name -notin $cleanImports -and 
            $sp.Name -notin $missingItems) {
            $missingItems += $sp.Name
        }
    }

    # Remove false positives (items that are defined in the same file)
    $definedInFile = @()
    $constMatches = [regex]::Matches($content, "(?:const|let|var|function|interface|type|class)\s+(\w+)")
    foreach ($match in $constMatches) {
        $definedInFile += $match.Groups[1].Value
    }
    $paramMatches = [regex]::Matches($content, "\(\s*\{?\s*(\w+)")
    foreach ($match in $paramMatches) {
        $definedInFile += $match.Groups[1].Value
    }
    $definedInFile = $definedInFile | Select-Object -Unique

    $missingItems = $missingItems | Where-Object { $_ -notin $definedInFile }

    # Remove duplicates and sort
    $missingItems = $missingItems | Select-Object -Unique | Sort-Object

    if ($missingItems.Count -gt 0) {
        $filesWithIssues++
        Write-Host "`n❌ $($file.FullName)" -ForegroundColor Red
        Write-Host "   Missing imports: $($missingItems -join ', ')" -ForegroundColor Yellow

        # Show line numbers where each missing item is used
        foreach ($item in $missingItems) {
            $usageLines = @()
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "\b$item\b" -and $lines[$i] -notmatch "import\s") {
                    $usageLines += ($i + 1)
                }
            }
            if ($usageLines.Count -gt 0) {
                $firstFew = $usageLines | Select-Object -First 3
                $ellipsis = if ($usageLines.Count -gt 3) { '...' } else { '' }
                Write-Host "   $item used on line(s): $($firstFew -join ', ')$ellipsis" -ForegroundColor DarkGray
            }
        }
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Total files scanned: $totalFiles" -ForegroundColor White
Write-Host "   Files with missing imports: $filesWithIssues" -ForegroundColor $(if($filesWithIssues -gt 0){'Red'}else{'Green'})

if ($filesWithIssues -eq 0) {
    Write-Host "`n✅ All imports look good!" -ForegroundColor Green
} else {
    Write-Host "`n💡 Tip: Add the missing imports manually or run a fix script." -ForegroundColor Cyan
}