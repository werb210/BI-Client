# Mobile release readiness

Allowed statuses: **READY**, **NEEDS CREDENTIALS**, **NEEDS MANUAL STORE SETUP**, **NOT IMPLEMENTED**.

## iOS / iPadOS
| Item | Status | Detail |
|---|---|---|
| Native project / bundle ID | READY | Capacitor project; `com.boreal.risk.client`, iOS 15+ |
| Signing | NEEDS CREDENTIALS | Register ID, choose paid Apple team, provisioning profile |
| Push capability / APNs | NEEDS CREDENTIALS | Enable capability and install production APNs credential |
| Icons | NOT IMPLEMENTED | Existing SVG is not a suitable production 1024px raster master; supply approved high-resolution Boreal asset |
| Privacy manifest | READY | App manifest declares no tracking or required-reason API use by app code; re-audit dependencies before submission |
| Usage descriptions | READY | Camera and photo selection are described specifically; no microphone access |
| Version/build | READY | Initial 1.0 (1), to be advanced by release process |
| TestFlight / screenshots / App Privacy | NEEDS MANUAL STORE SETUP | Archive, upload, test, screenshots and questionnaire |
| Privacy URL / support URL | NEEDS MANUAL STORE SETUP | Confirm public production URLs in App Store Connect |
| Universal Links | NOT IMPLEMENTED | Domain, Associated Domains entitlement and AASA are pending |

## Android
| Item | Status | Detail |
|---|---|---|
| Native project / application ID | READY | `com.boreal.risk.client`, min 24 |
| Target SDK | READY | compile/target API 36 |
| Release signing | NEEDS CREDENTIALS | Create and securely store production keystore; no fake key committed |
| FCM | NEEDS CREDENTIALS | Create Firebase project and supply protected `google-services.json` |
| Icons | NOT IMPLEMENTED | Supply approved high-resolution adaptive/round/monochrome production artwork |
| Data Safety / privacy policy | NEEDS MANUAL STORE SETUP | Complete against final data practices and publish URL |
| Internal testing / AAB | NEEDS MANUAL STORE SETUP | Create Play app, sign AAB, upload to internal track |
| Store screenshots | NEEDS MANUAL STORE SETUP | Capture approved phone/tablet imagery |
| Android App Links | NOT IMPLEMENTED | Domain, release SHA-256, verified filter and `assetlinks.json` pending |

## Account steps (later)
Apple: register `com.boreal.risk.client`, select paid team, enable Push Notifications (and Associated Domains after domain confirmation), create APNs production credential, configure signing/provisioning, archive, TestFlight, and complete App Store Connect submission.

Google: create Play Console app and Firebase project, protect the production release keystore, add `google-services.json`, record release SHA-256, publish `assetlinks.json` after the domain is known, generate signed AAB, run internal testing, and complete Data Safety/store listing.
