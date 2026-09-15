import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { BorealRiskPushCategories.register(); return true }
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool { ApplicationDelegateProxy.shared.application(app, open: url, options: options) }
    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool { ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler) }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) { NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken) }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) { NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error) }
}


// BI_CLIENT_IOS26_SCENE_v1 - iOS 26 requires the UIScene lifecycle; without it the
// Capacitor window never presents (blank/blue screen). Loads the same Main
// storyboard (CAPBridgeViewController) the app already used, so config parsing is
// unchanged. Kept in AppDelegate.swift so no Xcode project file edit is needed.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        let window = UIWindow(windowScene: windowScene)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        window.rootViewController = storyboard.instantiateInitialViewController()
        self.window = window
        window.makeKeyAndVisible()
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}

// BI_CLIENT_PUSH_OPT_IN_v241
// Without registered categories iOS ignores aps.category and shows no buttons.
// Both buttons open data.url through the existing pushNotificationActionPerformed listener.
enum BorealRiskPushCategories {
    static func register() {
        let upload = UNNotificationAction(identifier: "UPLOAD_NOW", title: "Upload Now", options: [.foreground, .authenticationRequired])
        let open = UNNotificationAction(identifier: "OPEN_APPLICATION", title: "Open", options: [.foreground, .authenticationRequired])
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(identifier: "DOCUMENT_REQUEST", actions: [upload, open], intentIdentifiers: [], options: []),
            UNNotificationCategory(identifier: "APPLICATION_UPDATE", actions: [open], intentIdentifiers: [], options: [])
        ])
    }
}
