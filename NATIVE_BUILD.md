# Native build guide

BI-Client remains a Vite web application embedded by Capacitor 8. `VITE_API_BASE` is public build-time configuration and must point only to the separately deployed BI-Server over HTTPS; use `.env.development`/CI production variables and never place secrets in `VITE_*`.

## Web
```sh
npm install
npm run dev
npm run build
```

## iOS / iPadOS
Requires current Xcode on macOS. Bundle ID: `com.boreal.risk.client`; minimum iOS: 15.
```sh
npm run build
npx cap sync ios
npx cap open ios
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
```
Select the paid Apple team in Xcode later; no team or profile is committed.

## Android
Application ID: `com.boreal.risk.client`; compile/target API: **36**; minimum API: 24.
```sh
npm run build
npx cap sync android
npx cap open android
cd android && ./gradlew assembleDebug
```
A release AAB can be built with `./gradlew bundleRelease` after real release signing is configured outside source control.

## Deep/universal links
`borealrisk://` is the installed fallback. Universal/App Links require a confirmed production client domain. Later add its `applinks:` Associated Domain and `apple-app-site-association` on iOS; add an HTTPS verified intent filter, `assetlinks.json`, and the release certificate SHA-256 on Android. Do not guess the domain.

## Push credentials
After a BI-Server device-registration contract exists, implement `DeviceRegistrationAdapter`. Put `GoogleService-Info.plist` into `ios/App/App` and `google-services.json` into `android/app` locally/through protected CI, enable iOS Push Notifications, create a production APNs credential, and configure Firebase. These files are ignored and are not currently required for a credential-free native build.
