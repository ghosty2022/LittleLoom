# auto-fix-imports.ps1
# Automatically fixes missing imports in all .tsx files
# Run: .\auto-fix-imports.ps1
# Creates .bak backups before modifying

$ErrorActionPreference = "Continue"

# Known import sources
$importMap = @{
    # react-native core
    'ActivityIndicator' = 'react-native'
    'Alert' = 'react-native'
    'Animated' = 'react-native'
    'Button' = 'react-native'
    'Dimensions' = 'react-native'
    'DrawerLayoutAndroid' = 'react-native'
    'FlatList' = 'react-native'
    'Image' = 'react-native'
    'ImageBackground' = 'react-native'
    'Keyboard' = 'react-native'
    'KeyboardAvoidingView' = 'react-native'
    'Linking' = 'react-native'
    'Modal' = 'react-native'
    'PermissionsAndroid' = 'react-native'
    'Platform' = 'react-native'
    'Pressable' = 'react-native'
    'RefreshControl' = 'react-native'
    'SafeAreaView' = 'react-native'
    'ScrollView' = 'react-native'
    'SectionList' = 'react-native'
    'Share' = 'react-native'
    'StatusBar' = 'react-native'
    'StyleSheet' = 'react-native'
    'Switch' = 'react-native'
    'Text' = 'react-native'
    'TextInput' = 'react-native'
    'ToastAndroid' = 'react-native'
    'TouchableHighlight' = 'react-native'
    'TouchableOpacity' = 'react-native'
    'TouchableWithoutFeedback' = 'react-native'
    'View' = 'react-native'
    'VirtualizedList' = 'react-native'
    'useColorScheme' = 'react-native'
    'useWindowDimensions' = 'react-native'
    'ActionSheetIOS' = 'react-native'
    'Appearance' = 'react-native'
    'BackHandler' = 'react-native'
    'Clipboard' = 'react-native'
    'DevSettings' = 'react-native'
    'InteractionManager' = 'react-native'
    'LayoutAnimation' = 'react-native'
    'LogBox' = 'react-native'
    'PanResponder' = 'react-native'
    'PixelRatio' = 'react-native'
    'Settings' = 'react-native'
    'Systrace' = 'react-native'
    'UIManager' = 'react-native'
    'Vibration' = 'react-native'

    # expo
    'BlurView' = 'expo-blur'
    'LinearGradient' = 'expo-linear-gradient'
    'Haptics' = 'expo-haptics'
    'useVideoPlayer' = 'expo-video'
    'VideoView' = 'expo-video'
    'AppleAuthentication' = 'expo-apple-authentication'
    'ImagePicker' = 'expo-image-picker'
    'CameraView' = 'expo-camera'
    'BarCodeScanner' = 'expo-barcode-scanner'
    'Calendar' = 'expo-calendar'
    'Contacts' = 'expo-contacts'
    'DocumentPicker' = 'expo-document-picker'
    'FileSystem' = 'expo-file-system'
    'LocalAuthentication' = 'expo-local-authentication'
    'Location' = 'expo-location'
    'MediaLibrary' = 'expo-media-library'
    'Notifications' = 'expo-notifications'
    'ScreenCapture' = 'expo-screen-capture'
    'SecureStore' = 'expo-secure-store'
    'Sharing' = 'expo-sharing'
    'SplashScreen' = 'expo-splash-screen'
    'SQLite' = 'expo-sqlite'
    'StoreReview' = 'expo-store-review'
    'TaskManager' = 'expo-task-manager'
    'Updates' = 'expo-updates'
    'WebBrowser' = 'expo-web-browser'
    'Audio' = 'expo-av'
    'Video' = 'expo-av'
    'ScreenOrientation' = 'expo-screen-orientation'
    'Brightness' = 'expo-brightness'
    'Crypto' = 'expo-crypto'
    'Font' = 'expo-font'
    'KeepAwake' = 'expo-keep-awake'
    'MailComposer' = 'expo-mail-composer'
    'Network' = 'expo-network'
    'Pedometer' = 'expo-sensors'
    'Accelerometer' = 'expo-sensors'
    'Barometer' = 'expo-sensors'
    'Gyroscope' = 'expo-sensors'
    'Magnetometer' = 'expo-sensors'
    'Print' = 'expo-print'
    'SMS' = 'expo-sms'
    'Speech' = 'expo-speech'
    'SymbolView' = 'expo-symbols'
    'SystemUI' = 'expo-system-ui'
    'TrackingTransparency' = 'expo-tracking-transparency'
    'VideoThumbnail' = 'expo-video-thumbnails'
    'Facebook' = 'expo-facebook'
    'GoogleSignIn' = 'expo-auth-session/providers/google'
    'AdMob' = 'expo-ads-admob'
    'Amplitude' = 'expo-analytics-amplitude'
    'Segment' = 'expo-analytics-segment'
    'Sentry' = 'sentry-expo'
    'Stripe' = '@stripe/stripe-react-native'
    'AuthSession' = 'expo-auth-session'
    'Random' = 'expo-random'
    'Sensor' = 'expo-sensors'

    # react-navigation
    'NavigationContainer' = '@react-navigation/native'
    'useNavigation' = '@react-navigation/native'
    'useRoute' = '@react-navigation/native'
    'useFocusEffect' = '@react-navigation/native'
    'useIsFocused' = '@react-navigation/native'
    'useScrollToTop' = '@react-navigation/native'
    'createNativeStackNavigator' = '@react-navigation/native-stack'
    'createBottomTabNavigator' = '@react-navigation/bottom-tabs'
    'createDrawerNavigator' = '@react-navigation/drawer'
    'createStackNavigator' = '@react-navigation/stack'
    'CommonActions' = '@react-navigation/native'
    'StackActions' = '@react-navigation/native'
    'DrawerActions' = '@react-navigation/native'
    'TabActions' = '@react-navigation/native'

    # react-native-reanimated
    'FadeIn' = 'react-native-reanimated'
    'FadeInUp' = 'react-native-reanimated'
    'FadeInDown' = 'react-native-reanimated'
    'FadeInLeft' = 'react-native-reanimated'
    'FadeInRight' = 'react-native-reanimated'
    'FadeOut' = 'react-native-reanimated'
    'FadeOutUp' = 'react-native-reanimated'
    'FadeOutDown' = 'react-native-reanimated'
    'FadeOutLeft' = 'react-native-reanimated'
    'FadeOutRight' = 'react-native-reanimated'
    'SlideInLeft' = 'react-native-reanimated'
    'SlideInRight' = 'react-native-reanimated'
    'SlideInUp' = 'react-native-reanimated'
    'SlideInDown' = 'react-native-reanimated'
    'SlideOutLeft' = 'react-native-reanimated'
    'SlideOutRight' = 'react-native-reanimated'
    'SlideOutUp' = 'react-native-reanimated'
    'SlideOutDown' = 'react-native-reanimated'
    'ZoomIn' = 'react-native-reanimated'
    'ZoomOut' = 'react-native-reanimated'
    'FlipInX' = 'react-native-reanimated'
    'FlipInY' = 'react-native-reanimated'
    'FlipOutX' = 'react-native-reanimated'
    'FlipOutY' = 'react-native-reanimated'
    'BounceIn' = 'react-native-reanimated'
    'BounceOut' = 'react-native-reanimated'
    'LightSpeedInLeft' = 'react-native-reanimated'
    'LightSpeedOutLeft' = 'react-native-reanimated'
    'PinwheelIn' = 'react-native-reanimated'
    'PinwheelOut' = 'react-native-reanimated'
    'RollInLeft' = 'react-native-reanimated'
    'RollOutLeft' = 'react-native-reanimated'
    'RotateInDownLeft' = 'react-native-reanimated'
    'RotateOutDownLeft' = 'react-native-reanimated'
    'StretchInX' = 'react-native-reanimated'
    'StretchOutX' = 'react-native-reanimated'
    'useSharedValue' = 'react-native-reanimated'
    'useAnimatedStyle' = 'react-native-reanimated'
    'useAnimatedReaction' = 'react-native-reanimated'
    'useAnimatedProps' = 'react-native-reanimated'
    'useAnimatedScrollHandler' = 'react-native-reanimated'
    'useAnimatedRef' = 'react-native-reanimated'
    'useDerivedValue' = 'react-native-reanimated'
    'useAnimatedGestureHandler' = 'react-native-reanimated'
    'useWorkletCallback' = 'react-native-reanimated'
    'useFrameCallback' = 'react-native-reanimated'
    'withSpring' = 'react-native-reanimated'
    'withTiming' = 'react-native-reanimated'
    'withDecay' = 'react-native-reanimated'
    'withDelay' = 'react-native-reanimated'
    'withRepeat' = 'react-native-reanimated'
    'withSequence' = 'react-native-reanimated'
    'withClamp' = 'react-native-reanimated'
    'cancelAnimation' = 'react-native-reanimated'
    'runOnJS' = 'react-native-reanimated'
    'runOnUI' = 'react-native-reanimated'
    'interpolate' = 'react-native-reanimated'
    'interpolateColor' = 'react-native-reanimated'
    'Extrapolation' = 'react-native-reanimated'
    'Easing' = 'react-native-reanimated'
    'Layout' = 'react-native-reanimated'
    'EntryExitTransition' = 'react-native-reanimated'
    'LinearTransition' = 'react-native-reanimated'
    'SequencedTransition' = 'react-native-reanimated'
    'FadingTransition' = 'react-native-reanimated'
    'JumpingTransition' = 'react-native-reanimated'
    'CurvedTransition' = 'react-native-reanimated'
    'measure' = 'react-native-reanimated'
    'scrollTo' = 'react-native-reanimated'
    'createAnimatedPropAdapter' = 'react-native-reanimated'
    'SensorType' = 'react-native-reanimated'
    'useAnimatedSensor' = 'react-native-reanimated'
    'useReducedMotion' = 'react-native-reanimated'
    'GestureHandlerRootView' = 'react-native-gesture-handler'

    # vector icons
    'Ionicons' = '@expo/vector-icons'
    'MaterialIcons' = '@expo/vector-icons'
    'FontAwesome' = '@expo/vector-icons'
    'Feather' = '@expo/vector-icons'
    'Entypo' = '@expo/vector-icons'
    'AntDesign' = '@expo/vector-icons'
    'MaterialCommunityIcons' = '@expo/vector-icons'
    'Octicons' = '@expo/vector-icons'
    'SimpleLineIcons' = '@expo/vector-icons'
    'EvilIcons' = '@expo/vector-icons'
    'Foundation' = '@expo/vector-icons'
    'Zocial' = '@expo/vector-icons'

    # common local components/hooks
    'SafeAvatar' = '../../components/SafeAvatar'
    'AutoHideScrollView' = '../../components/AutoHideScrollView'
    'AutoHideFlatList' = '../../components/AutoHideFlatList'
    'GlassmorphismCard' = '../../components/GlassmorphismCard'
    'CircularProgress' = '../../components/CircularProgress'
    'LoadingSpinner' = '../../components/LoadingSpinner'
    'EmptyState' = '../../components/EmptyState'
    'ErrorBoundary' = '../../components/ErrorBoundary'
    'showAlert' = '@/utils/alert'
    'showToast' = '@/utils/alert'
    'showError' = '@/utils/alert'
    'useApp' = '../../context/AppContext'
    'useAuth' = '../../context/AuthContext'
    'useUser' = '../../context/UserContext'
    'useCommunity' = '../../context/CommunityContext'
    'useBaby' = '../../context/BabyContext'
    'useTracker' = '../../context/TrackerContext'
    'useGallery' = '../../context/GalleryContext'
    'useFamily' = '../../context/FamilyContext'
    'useSettings' = '../../context/SettingsContext'
    'useTheme' = '../../hooks/useTheme'
    'useCustomization' = '../../hooks/useCustomization'
    'useSafeCustomization' = '../../hooks/useSafeContexts'
    'useSweetAlert' = '../../components/SweetAlert'
    'useAutoHideNav' = '../../hooks/useAutoHideNav'
    'useReportRoute' = '../../hooks/useReportRoute'
    'useSafeAreaInsets' = 'react-native-safe-area-context'
}

# Patterns to detect usage
$usagePatterns = @{
    'StyleSheet' = 'StyleSheet\.'
    'Dimensions' = 'Dimensions\.'
    'Platform' = 'Platform\.'
    'StatusBar' = 'StatusBar\.'
    'Animated' = '(?<!react-native-reanimated.*)Animated\.'
    'Linking' = 'Linking\.'
    'Share' = 'Share\.'
    'Haptics' = 'Haptics\.'
    'Easing' = 'Easing\.'
    'Extrapolation' = 'Extrapolation\.'
    'Keyboard' = 'Keyboard\.'
    'Clipboard' = 'Clipboard\.'
    'InteractionManager' = 'InteractionManager\.'
    'LogBox' = 'LogBox\.'
    'ActionSheetIOS' = 'ActionSheetIOS\.'
    'BackHandler' = 'BackHandler\.'
    'Appearance' = 'Appearance\.'
    'useSharedValue' = 'useSharedValue\s*\('
    'useAnimatedStyle' = 'useAnimatedStyle\s*\('
    'useAnimatedReaction' = 'useAnimatedReaction\s*\('
    'useAnimatedScrollHandler' = 'useAnimatedScrollHandler\s*\('
    'useAnimatedRef' = 'useAnimatedRef\s*\('
    'useDerivedValue' = 'useDerivedValue\s*\('
    'useAnimatedGestureHandler' = 'useAnimatedGestureHandler\s*\('
    'useWorkletCallback' = 'useWorkletCallback\s*\('
    'useFrameCallback' = 'useFrameCallback\s*\('
    'useAnimatedProps' = 'useAnimatedProps\s*\('
    'useAnimatedSensor' = 'useAnimatedSensor\s*\('
    'useReducedMotion' = 'useReducedMotion\s*\('
    'withSpring' = 'withSpring\s*\('
    'withTiming' = 'withTiming\s*\('
    'withDecay' = 'withDecay\s*\('
    'withDelay' = 'withDelay\s*\('
    'withRepeat' = 'withRepeat\s*\('
    'withSequence' = 'withSequence\s*\('
    'withClamp' = 'withClamp\s*\('
    'cancelAnimation' = 'cancelAnimation\s*\('
    'runOnJS' = 'runOnJS\s*\('
    'runOnUI' = 'runOnUI\s*\('
    'interpolateColor' = 'interpolateColor\s*\('
    'interpolate' = '(?<!interpolateColor)interpolate\s*\('
    'measure' = 'measure\s*\('
    'scrollTo' = 'scrollTo\s*\('
    'createAnimatedPropAdapter' = 'createAnimatedPropAdapter\s*\('
    'FadeInUp' = '(?<!\.)FadeInUp\b'
    'FadeIn' = '(?<!\.)FadeIn\b'
    'FadeInDown' = '(?<!\.)FadeInDown\b'
    'FadeInLeft' = '(?<!\.)FadeInLeft\b'
    'FadeInRight' = '(?<!\.)FadeInRight\b'
    'FadeOut' = '(?<!\.)FadeOut\b'
    'FadeOutUp' = '(?<!\.)FadeOutUp\b'
    'FadeOutDown' = '(?<!\.)FadeOutDown\b'
    'FadeOutLeft' = '(?<!\.)FadeOutLeft\b'
    'FadeOutRight' = '(?<!\.)FadeOutRight\b'
    'SlideInLeft' = '(?<!\.)SlideInLeft\b'
    'SlideInRight' = '(?<!\.)SlideInRight\b'
    'SlideInUp' = '(?<!\.)SlideInUp\b'
    'SlideInDown' = '(?<!\.)SlideInDown\b'
    'SlideOutLeft' = '(?<!\.)SlideOutLeft\b'
    'SlideOutRight' = '(?<!\.)SlideOutRight\b'
    'SlideOutUp' = '(?<!\.)SlideOutUp\b'
    'SlideOutDown' = '(?<!\.)SlideOutDown\b'
    'ZoomIn' = '(?<!\.)ZoomIn\b'
    'ZoomOut' = '(?<!\.)ZoomOut\b'
    'FlipInX' = '(?<!\.)FlipInX\b'
    'FlipInY' = '(?<!\.)FlipInY\b'
    'FlipOutX' = '(?<!\.)FlipOutX\b'
    'FlipOutY' = '(?<!\.)FlipOutY\b'
    'BounceIn' = '(?<!\.)BounceIn\b'
    'BounceOut' = '(?<!\.)BounceOut\b'
    'LightSpeedInLeft' = '(?<!\.)LightSpeedInLeft\b'
    'LightSpeedOutLeft' = '(?<!\.)LightSpeedOutLeft\b'
    'PinwheelIn' = '(?<!\.)PinwheelIn\b'
    'PinwheelOut' = '(?<!\.)PinwheelOut\b'
    'RollInLeft' = '(?<!\.)RollInLeft\b'
    'RollOutLeft' = '(?<!\.)RollOutLeft\b'
    'RotateInDownLeft' = '(?<!\.)RotateInDownLeft\b'
    'RotateOutDownLeft' = '(?<!\.)RotateOutDownLeft\b'
    'StretchInX' = '(?<!\.)StretchInX\b'
    'StretchOutX' = '(?<!\.)StretchOutX\b'
    'Layout' = '(?<!\.)Layout\b'
    'EntryExitTransition' = '(?<!\.)EntryExitTransition\b'
    'LinearTransition' = '(?<!\.)LinearTransition\b'
    'SequencedTransition' = '(?<!\.)SequencedTransition\b'
    'FadingTransition' = '(?<!\.)FadingTransition\b'
    'JumpingTransition' = '(?<!\.)JumpingTransition\b'
    'CurvedTransition' = '(?<!\.)CurvedTransition\b'
    'BlurView' = '(?<!\.)BlurView\b'
    'LinearGradient' = '(?<!\.)LinearGradient\b'
    'Ionicons' = '(?<!\.)Ionicons\b'
    'useVideoPlayer' = 'useVideoPlayer\s*\('
    'VideoView' = '(?<!\.)VideoView\b'
    'AppleAuthentication' = '(?<!\.)AppleAuthentication\b'
    'GestureHandlerRootView' = '(?<!\.)GestureHandlerRootView\b'
    'SafeAvatar' = '(?<!\.)SafeAvatar\b'
    'AutoHideScrollView' = '(?<!\.)AutoHideScrollView\b'
    'AutoHideFlatList' = '(?<!\.)AutoHideFlatList\b'
    'GlassmorphismCard' = '(?<!\.)GlassmorphismCard\b'
    'CircularProgress' = '(?<!\.)CircularProgress\b'
    'LoadingSpinner' = '(?<!\.)LoadingSpinner\b'
    'EmptyState' = '(?<!\.)EmptyState\b'
    'ErrorBoundary' = '(?<!\.)ErrorBoundary\b'
    'showAlert' = 'showAlert\s*\('
    'showToast' = 'showToast\s*\('
    'showError' = 'showError\s*\('
    'useApp' = 'useApp\s*\('
    'useAuth' = 'useAuth\s*\('
    'useUser' = 'useUser\s*\('
    'useCommunity' = 'useCommunity\s*\('
    'useBaby' = 'useBaby\s*\('
    'useTracker' = 'useTracker\s*\('
    'useGallery' = 'useGallery\s*\('
    'useFamily' = 'useFamily\s*\('
    'useSettings' = 'useSettings\s*\('
    'useTheme' = 'useTheme\s*\('
    'useCustomization' = 'useCustomization\s*\('
    'useSafeCustomization' = 'useSafeCustomization\s*\('
    'useSweetAlert' = 'useSweetAlert\s*\('
    'useAutoHideNav' = 'useAutoHideNav\s*\('
    'useReportRoute' = 'useReportRoute\s*\('
    'useSafeAreaInsets' = 'useSafeAreaInsets\s*\('
    'useColorScheme' = 'useColorScheme\s*\('
    'useWindowDimensions' = 'useWindowDimensions\s*\('
    'useNavigation' = 'useNavigation\s*\('
    'useRoute' = 'useRoute\s*\('
    'useFocusEffect' = 'useFocusEffect\s*\('
    'useIsFocused' = 'useIsFocused\s*\('
    'useScrollToTop' = 'useScrollToTop\s*\('
    'NavigationContainer' = '(?<!\.)NavigationContainer\b'
    'createNativeStackNavigator' = 'createNativeStackNavigator\s*\('
    'createBottomTabNavigator' = 'createBottomTabNavigator\s*\('
    'createDrawerNavigator' = 'createDrawerNavigator\s*\('
    'createStackNavigator' = 'createStackNavigator\s*\('
    'CommonActions' = '(?<!\.)CommonActions\b'
    'StackActions' = '(?<!\.)StackActions\b'
    'DrawerActions' = '(?<!\.)DrawerActions\b'
    'TabActions' = '(?<!\.)TabActions\b'
    'ActivityIndicator' = '(?<!\.)ActivityIndicator\b'
    'Button' = '(?<!\.)Button\b'
    'Alert' = '(?<!\.)Alert\b'
    'FlatList' = '(?<!\.)FlatList\b'
    'Image' = '(?<!\.)Image\b'
    'ImageBackground' = '(?<!\.)ImageBackground\b'
    'KeyboardAvoidingView' = '(?<!\.)KeyboardAvoidingView\b'
    'Modal' = '(?<!\.)Modal\b'
    'Pressable' = '(?<!\.)Pressable\b'
    'RefreshControl' = '(?<!\.)RefreshControl\b'
    'SafeAreaView' = '(?<!\.)SafeAreaView\b'
    'ScrollView' = '(?<!\.)ScrollView\b'
    'SectionList' = '(?<!\.)SectionList\b'
    'Switch' = '(?<!\.)Switch\b'
    'Text' = '(?<!\.)Text\b'
    'TextInput' = '(?<!\.)TextInput\b'
    'TouchableHighlight' = '(?<!\.)TouchableHighlight\b'
    'TouchableOpacity' = '(?<!\.)TouchableOpacity\b'
    'TouchableWithoutFeedback' = '(?<!\.)TouchableWithoutFeedback\b'
    'View' = '(?<!\.)View\b'
    'VirtualizedList' = '(?<!\.)VirtualizedList\b'
    'DrawerLayoutAndroid' = '(?<!\.)DrawerLayoutAndroid\b'
    'InputAccessoryView' = '(?<!\.)InputAccessoryView\b'
    'PermissionsAndroid' = '(?<!\.)PermissionsAndroid\b'
    'ToastAndroid' = '(?<!\.)ToastAndroid\b'
    'DevSettings' = '(?<!\.)DevSettings\b'
    'LayoutAnimation' = '(?<!\.)LayoutAnimation\b'
    'PanResponder' = '(?<!\.)PanResponder\b'
    'PixelRatio' = '(?<!\.)PixelRatio\b'
    'Settings' = '(?<!\.)Settings\b'
    'Systrace' = '(?<!\.)Systrace\b'
    'UIManager' = '(?<!\.)UIManager\b'
    'Vibration' = '(?<!\.)Vibration\b'
}

function Get-UsedItems($content) {
    $used = @{}
    foreach ($pattern in $usagePatterns.GetEnumerator()) {
        $name = $pattern.Key
        $regex = $pattern.Value
        try {
            if ($content -match $regex) {
                $used[$name] = $true
            }
        } catch { }
    }
    return $used.Keys
}

function Get-ImportedItems($content) {
    $imported = @{}

    # Named imports: import { A, B } from '...'
    $namedMatches = [regex]::Matches($content, "import\s*\{([^}]+)\}\s*from\s*['`"](.+?)['`"]")
    foreach ($match in $namedMatches) {
        $items = $match.Groups[1].Value -split ',' | ForEach-Object { 
            $_.Trim() -replace "^type\s+", "" -replace "\s+as\s+.*", "" -replace "\s+", "" 
        }
        foreach ($item in $items) {
            if ($item) { $imported[$item] = $true }
        }
    }

    # Default imports: import React from '...'
    $defaultMatches = [regex]::Matches($content, "import\s+(\w+)\s+from\s*['`"](.+?)['`"]")
    foreach ($match in $defaultMatches) {
        $imported[$match.Groups[1].Value] = $true
    }

    # Wildcard imports: import * as X from '...'
    $wildcardMatches = [regex]::Matches($content, "import\s*\*\s*as\s*(\w+)\s*from\s*['`"](.+?)['`"]")
    foreach ($match in $wildcardMatches) {
        $imported[$match.Groups[1].Value] = $true
    }

    return $imported.Keys
}

function Get-DefinedItems($content) {
    $defined = @{}
    # const/let/var/function definitions
    $matches = [regex]::Matches($content, "(?:const|let|var|function)\s+(\w+)")
    foreach ($match in $matches) {
        $defined[$match.Groups[1].Value] = $true
    }
    # interface/type/class
    $matches = [regex]::Matches($content, "(?:interface|type|class)\s+(\w+)")
    foreach ($match in $matches) {
        $defined[$match.Groups[1].Value] = $true
    }
    # function parameters (rough)
    $matches = [regex]::Matches($content, "\(\s*\{?\s*(\w+)")
    foreach ($match in $matches) {
        $defined[$match.Groups[1].Value] = $true
    }
    return $defined.Keys
}

$files = Get-ChildItem -Path "src\screens" -Recurse -Include *.tsx
$fixedCount = 0
$totalFiles = 0

foreach ($file in $files) {
    $totalFiles++
    $content = Get-Content $file.FullName -Raw

    # Skip if no JSX
    if ($content -notmatch "return\s*\(") { continue }

    $used = Get-UsedItems $content
    $imported = Get-ImportedItems $content
    $defined = Get-DefinedItems $content

    $missing = @()
    foreach ($item in $used) {
        if ($item -notin $imported -and $item -notin $defined) {
            $missing += $item
        }
    }

    if ($missing.Count -eq 0) { continue }

    Write-Host "`n🔧 Fixing: $($file.FullName)" -ForegroundColor Yellow
    Write-Host "   Missing: $($missing -join ', ')" -ForegroundColor Cyan

    # Group missing items by their source
    $bySource = @{}
    foreach ($item in $missing) {
        $source = $importMap[$item]
        if (-not $source) { 
            Write-Host "   ⚠️ Unknown source for: $item" -ForegroundColor DarkYellow
            continue 
        }
        if (-not $bySource[$source]) { $bySource[$source] = @() }
        $bySource[$source] += $item
    }

    # Create backup
    $backupPath = $file.FullName + ".bak"
    if (-not (Test-Path $backupPath)) {
        Copy-Item $file.FullName $backupPath
    }

    $newContent = $content

    foreach ($source in $bySource.GetEnumerator()) {
        $sourcePath = $source.Key
        $items = $source.Value | Sort-Object -Unique

        # Check if there's already an import from this source
        $existingImport = [regex]::Match($newContent, "import\s*\{([^}]*)\}\s*from\s*['`"]$([regex]::Escape($sourcePath))['`"]")

        if ($existingImport.Success) {
            # Add to existing import
            $existingItems = $existingImport.Groups[1].Value -split ',' | ForEach-Object { $_.Trim() }
            $allItems = ($existingItems + $items) | Select-Object -Unique | Sort-Object
            $newImport = "import { $($allItems -join ', ') } from '$sourcePath';"
            $newContent = $newContent -replace [regex]::Escape($existingImport.Value), $newImport
        } else {
            # Check for default import from same source
            $defaultImport = [regex]::Match($newContent, "import\s+(\w+)\s+from\s*['`"]$([regex]::Escape($sourcePath))['`"]")
            if ($defaultImport.Success) {
                # Convert to named + default import
                $defaultName = $defaultImport.Groups[1].Value
                $newImport = "import $defaultName, { $($items -join ', ') } from '$sourcePath';"
                $newContent = $newContent -replace [regex]::Escape($defaultImport.Value), $newImport
            } else {
                # Add new import line
                $newImport = "import { $($items -join ', ') } from '$sourcePath';"
                # Insert after the last import or at the top
                $lastImport = [regex]::Match($newContent, "(import\s+.*?from\s*['`"].*?['`"];\s*\n)")
                if ($lastImport.Success) {
                    $newContent = $newContent -replace [regex]::Escape($lastImport.Groups[1].Value), "$($lastImport.Groups[1].Value)$newImport`n"
                } else {
                    $newContent = "$newImport`n$newContent"
                }
            }
        }
    }

    # Write the fixed content
    Set-Content -Path $file.FullName -Value $newContent -NoNewline
    $fixedCount++
    Write-Host "   ✅ Fixed!" -ForegroundColor Green
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Total files scanned: $totalFiles" -ForegroundColor White
Write-Host "   Files fixed: $fixedCount" -ForegroundColor Green

if ($fixedCount -gt 0) {
    Write-Host "`n🎉 Done! Backups saved as .bak files." -ForegroundColor Green
    Write-Host "   Run 'npx expo start --clear' to test." -ForegroundColor Cyan
    Write-Host "   If something breaks, restore with:" -ForegroundColor DarkGray
    Write-Host "   Get-ChildItem -Recurse -Filter '*.bak' | ForEach-Object { Move-Item `$_.FullName `$_.FullName.Replace('.bak','') -Force }" -ForegroundColor DarkGray
}