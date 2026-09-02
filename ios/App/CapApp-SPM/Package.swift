// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapApp-SPM", targets: ["CapApp-SPM"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.1"),
        .package(path: "../../../node_modules/@capacitor/app"),
        .package(path: "../../../node_modules/@capacitor/app-launcher"),
        .package(path: "../../../node_modules/@capacitor/camera"),
        .package(path: "../../../node_modules/@capacitor/device"),
        .package(path: "../../../node_modules/@capacitor/filesystem"),
        .package(path: "../../../node_modules/@capacitor/keyboard"),
        .package(path: "../../../node_modules/@capacitor/network"),
        .package(path: "../../../node_modules/@capacitor/preferences"),
        .package(path: "../../../node_modules/@capacitor/push-notifications"),
        .package(path: "../../../node_modules/@capacitor/splash-screen"),
        .package(path: "../../../node_modules/@capacitor/status-bar"),
        .package(path: "../../../node_modules/@capawesome/capacitor-file-picker"),
        .package(path: "../../../node_modules/@aparajita/capacitor-secure-storage"),
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "app"),
                .product(name: "CapacitorAppLauncher", package: "app-launcher"),
                .product(name: "CapacitorCamera", package: "camera"),
                .product(name: "CapacitorDevice", package: "device"),
                .product(name: "CapacitorFilesystem", package: "filesystem"),
                .product(name: "CapacitorKeyboard", package: "keyboard"),
                .product(name: "CapacitorNetwork", package: "network"),
                .product(name: "CapacitorPreferences", package: "preferences"),
                .product(name: "CapacitorPushNotifications", package: "push-notifications"),
                .product(name: "CapacitorSplashScreen", package: "splash-screen"),
                .product(name: "CapacitorStatusBar", package: "status-bar"),
                .product(name: "FilePicker", package: "capacitor-file-picker"),
                .product(name: "SecureStoragePlugin", package: "capacitor-secure-storage"),
            ]
        ),
    ]
)
