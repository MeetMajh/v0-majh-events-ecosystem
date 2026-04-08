# Capacitor Setup Guide for MAJH EVENTS

This guide explains how to build native iOS and Android apps from the MAJH EVENTS web app using Capacitor.

## Prerequisites

### For iOS Development
- macOS (required)
- Xcode 14+ from the Mac App Store
- Apple Developer Account ($99/year) for App Store distribution
- CocoaPods: `sudo gem install cocoapods`

### For Android Development
- Android Studio (any OS)
- Java JDK 17+
- Android SDK (installed via Android Studio)
- Google Play Developer Account ($25 one-time) for Play Store distribution

## Initial Setup

### 1. Install Capacitor CLI and Core

```bash
npm install @capacitor/cli @capacitor/core
npm install @capacitor/ios @capacitor/android
```

### 2. Install Capacitor Plugins (Optional but Recommended)

```bash
# Core plugins
npm install @capacitor/app @capacitor/haptics @capacitor/keyboard
npm install @capacitor/status-bar @capacitor/splash-screen

# Push notifications
npm install @capacitor/push-notifications

# Other useful plugins
npm install @capacitor/browser @capacitor/share @capacitor/toast
npm install @capacitor/device @capacitor/network @capacitor/storage
```

### 3. Configure Next.js for Static Export

Edit `next.config.mjs` and uncomment the static export line:

```js
const nextConfig = {
  output: 'export',  // Enable this for Capacitor builds
  // ... rest of config
}
```

**Note:** Static export mode disables some Next.js features (API routes, server components). For the mobile app, you'll need to point API calls to your deployed Vercel URL.

### 4. Add Native Platforms

```bash
# Add iOS platform
npm run cap:add:ios

# Add Android platform  
npm run cap:add:android
```

## Building for Development

### Build and Sync Web Assets

```bash
# Build the Next.js app and sync to native projects
npm run cap:build:ios
# or
npm run cap:build:android
```

### Open in Native IDE

```bash
# Open in Xcode (iOS)
npm run cap:open:ios

# Open in Android Studio (Android)
npm run cap:open:android
```

### Run on Device/Simulator

```bash
# Run on iOS simulator or connected device
npm run cap:run:ios

# Run on Android emulator or connected device
npm run cap:run:android
```

## iOS-Specific Setup

### 1. Configure Signing in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the "App" target
3. Go to "Signing & Capabilities"
4. Select your Team (Apple Developer Account)
5. Xcode will create provisioning profiles automatically

### 2. Update App Icons

Replace icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### 3. Configure Splash Screen

Update `ios/App/App/Assets.xcassets/Splash.imageset/`

### 4. Build for App Store

1. In Xcode, select "Any iOS Device" as target
2. Product → Archive
3. Window → Organizer → Distribute App
4. Follow App Store Connect submission steps

## Android-Specific Setup

### 1. Configure Signing

Create a keystore for signing releases:

```bash
keytool -genkey -v -keystore majh-events-release.keystore \
  -alias majhevents -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('majh-events-release.keystore')
            storePassword 'your-password'
            keyAlias 'majhevents'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 2. Update App Icons

Replace icons in `android/app/src/main/res/mipmap-*` directories

### 3. Configure Splash Screen

Update `android/app/src/main/res/drawable/splash.xml`

### 4. Build for Play Store

```bash
cd android
./gradlew bundleRelease
```

The AAB file will be at `android/app/build/outputs/bundle/release/app-release.aab`

## Live Development

For faster development cycles, you can point the app to your dev server:

1. Edit `capacitor.config.ts`:
```ts
server: {
  url: 'http://YOUR_LOCAL_IP:3000',
  cleartext: true,
}
```

2. Run `npm run dev` on your computer
3. Run the app on your device - it will load from your dev server

## Environment Variables

For production builds, API calls should go to your deployed Vercel URL:

```ts
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://majhevents.com'
```

## Push Notifications

### iOS Setup

1. Enable Push Notifications capability in Xcode
2. Create APNs Key in Apple Developer Portal
3. Add key to your push notification service

### Android Setup

1. Create Firebase project
2. Add `google-services.json` to `android/app/`
3. Configure FCM in Firebase Console

## Troubleshooting

### iOS Build Fails
- Run `pod install` in the `ios/App` directory
- Clean build folder: Cmd+Shift+K in Xcode

### Android Build Fails
- Sync Gradle files in Android Studio
- Invalidate caches: File → Invalidate Caches

### Web Assets Not Updating
- Run `npm run cap:sync` after any web changes
- Delete `out/` folder and rebuild

## Useful Commands

```bash
# Sync web assets to native projects
npm run cap:sync

# List available devices
npx cap run ios --list
npx cap run android --list

# Update Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest
npx cap sync
```

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Guidelines](https://play.google.com/about/developer-content-policy/)
