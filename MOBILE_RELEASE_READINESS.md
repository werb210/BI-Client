# Boreal Risk mobile release readiness

This repository is the **BI applicant silo only**. Mobile code must use the existing
BI applicant API contract; it must not access BF or SLF routes, credentials, or data.

## Release status

| Release fact | Current state |
|---|---|
| Product | **Boreal Risk** |
| Bundle ID | `com.boreal.risk.client` |
| Supported native platforms | **iPhone, iPad, Android** |
| iOS code state | **Unsigned simulator build verified by CI** |
| Android code state | **Debug APK build verified by CI** |

Production distribution credentials are not committed or assumed to exist. An Apple
Developer account is still required for production signing, App ID/capabilities,
APNs production configuration, provisioning profiles, App Store Connect, TestFlight,
and physical-device installation. Android release still requires release signing,
Play Console configuration, and production app/store artwork where applicable.
Missing store artwork is a **NEEDS MANUAL ASSET** item.

## Application identity and supported links

| Setting | Value / status |
|---|---|
| Display name | `Boreal Risk` — READY |
| iOS bundle ID | `com.boreal.risk.client` — READY |
| Android application ID | `com.boreal.risk.client` — READY |
| Web output | `dist` — READY |
| Custom URL scheme | `borealrisk://` — READY |
| Web transport in native shell | HTTPS; Android cleartext disabled — READY |

The custom scheme accepts only the existing applicant routes: `/start`, `/home`,
`/upload`, and `/coverage/:applicationId`, `/questions/:applicationId`,
`/review/:applicationId`, or `/requirements/:applicationId`. Protected destinations
are held in memory while the applicant signs in and consumed once after successful
authentication. Do not put tokens, phone numbers, or other secrets in links.

Universal Links and Android App Links are **NOT IMPLEMENTED** because no production
domain was supplied. When a domain is approved, configure the Apple Associated
Domains entitlement and AASA file, plus an Android verified HTTPS intent filter and
`assetlinks.json`. Do not replace the custom scheme until those files are deployed.

## Security, uploads, and runtime behavior

- Native JWT/session values use the platform-backed secure-storage plug-in (iOS
  Keychain and Android encrypted/native-secure storage). Native failures fail closed
  and never fall back to `localStorage`. Browser storage remains available only for
  the normal web build. Logout removes the BI applicant token and phone value.
- Authentication restoration finishes before the router mounts. Lifecycle listeners
  do not repeat restoration or application API requests.
- The document picker accepts PDF, DOC, DOCX, PNG, JPG, and JPEG. Photo-library and
  camera choices are explicit user actions. The app uses scoped picker URIs and has
  no legacy broad storage permission. The current 25 MB client limit is preserved.
- Android system back closes an open dialog, then traverses React history, and exits
  only at `/`. Capacitor native keyboard resize, safe-area CSS, and status-bar setup
  cover supported phones and tablets without changing desktop layout.
- Push support only registers an already-authorized device and handles notification
  actions. It intentionally sends no device token because no BI server registration
  contract exists.

## iOS / iPadOS checklist

| Item | Status | Release action |
|---|---|---|
| Capacitor SwiftPM / iOS 15+ target | READY | Re-run `npx cap sync ios` after dependency changes. |
| App ID and signing | NEEDS CREDENTIALS | Register the explicit bundle ID in the paid Apple Developer team; select the team and production provisioning. |
| Push Notifications | NEEDS CREDENTIALS | Enable the capability, create an APNs key/certificate, add the entitlement, and implement the BI server device-registration contract. |
| Keychain | READY | Secure storage is application-scoped; review access groups if sharing is ever proposed (sharing is not currently allowed). |
| Camera / photo disclosure | READY | Reconfirm the purpose strings during privacy review. |
| Privacy manifest | NEEDS MANUAL REVIEW | Re-audit app and third-party required-reason APIs, tracking declarations, collected-data disclosures, and App Privacy answers before every submission. |
| Production icons / launch presentation | **NEEDS MANUAL ASSET** | Supply approved App Store icon and launch assets; do not generate them in this repository. |
| Store screenshots / promotional art | **NEEDS MANUAL ASSET** | Supply approved iPhone/iPad screenshots and any promotional artwork. |
| Support / privacy URLs | NEEDS MANUAL STORE SETUP | Confirm public production URLs in App Store Connect. |

### TestFlight sequence

1. Supply manual assets, select the Apple team, enable required capabilities, and
   increment marketing/build versions.
2. Run web and native tests, sync iOS, then archive a Release build in Xcode.
3. Validate and upload the archive; resolve signing and privacy-manifest warnings.
4. Complete App Privacy, export-compliance, review-contact, support, and privacy URL
   fields in App Store Connect.
5. Distribute to internal TestFlight testers, then external testers if required;
   verify cold start, OTP, deferred deep links, uploads, resume, and push on devices.
6. Attach the approved build and manual screenshots and submit for review.

## Android checklist

| Item | Status | Release action |
|---|---|---|
| SDK levels | READY | min 24, compile 36, target 36. |
| Network policy / permissions | READY | Cleartext is disabled; INTERNET, notification, and camera permissions only; no broad storage permission. |
| Release signing | NEEDS CREDENTIALS | Create the upload key outside Git, protect it in CI secrets, configure release signing, and enroll in Play App Signing. Never commit a keystore. |
| FCM push | NEEDS CREDENTIALS | Create/choose the real Firebase project, add the application, provide `google-services.json` outside this PR, and implement the BI server registration contract. |
| Data Safety / privacy policy | NEEDS MANUAL REVIEW | Complete from verified final data practices and publish the approved privacy-policy URL. |
| Production adaptive / round / monochrome icons | **NEEDS MANUAL ASSET** | Supply approved Android artwork; do not generate it in this repository. |
| Feature graphic / screenshots | **NEEDS MANUAL ASSET** | Supply approved phone/tablet store artwork. |

### Play Console sequence

1. Create the Play app with package `com.boreal.risk.client`, configure Play App
   Signing, and secure the upload key outside the repository.
2. Supply manual assets, increment version code/name, build the signed release AAB,
   and upload it to Internal testing.
3. Complete App access (including reviewer OTP instructions), Data Safety, content
   rating, target audience, ads, privacy policy, and store listing declarations.
4. Test install/upgrade, OTP, deferred deep links, Files/photo/camera uploads, system
   back, keyboard, process resume, and notification opt-in on API 24 and API 36.
5. Promote through closed/open testing as required, review pre-launch reports, then
   submit the production rollout.

## Push and server work still required

No Firebase file, APNs credential, fake endpoint, or server shortcut belongs in this
foundation. Before enabling user opt-in, the BI server must define an authenticated,
BI-only contract to register, rotate, and revoke opaque device tokens; enforce
applicant authorization for every payload; avoid sensitive notification text; and
provide expiry, logout revocation, observability, and privacy-retention rules.

## Final release gate

- Re-run `npm ci`, typecheck, tests, production build, both Capacitor syncs, Android
  debug assembly, and any native tests available in the selected Xcode/Gradle tools.
- Confirm no BF/SLF imports, URLs, route calls, storage keys, or credentials exist.
- Review the final diff for secrets and forbidden binary extensions. This foundation
  PR is text-only; generated APK/AAB/JAR, signing/provisioning files, and all raster
  artwork must remain untracked.
