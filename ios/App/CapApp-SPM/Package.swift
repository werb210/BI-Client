// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "CapApp-SPM", platforms: [.iOS(.v15)], products: [.library(name: "CapApp-SPM", targets: ["CapApp-SPM"])], dependencies: [
.package(path: "../../../node_modules/@capacitor/ios"),
.package(path: "../../../node_modules/@capacitor/app"),
.package(path: "../../../node_modules/@capacitor/camera"),
.package(path: "../../../node_modules/@capacitor/keyboard"),
.package(path: "../../../node_modules/@capacitor/network"),
.package(path: "../../../node_modules/@capacitor/preferences"),
.package(path: "../../../node_modules/@capacitor/push-notifications"),
.package(path: "../../../node_modules/@capacitor/splash-screen"),
.package(path: "../../../node_modules/@capacitor/status-bar")
], targets: [.target(name: "CapApp-SPM", dependencies: [.product(name: "Capacitor", package: "ios"), .product(name: "CapacitorCordova", package: "ios")])])
