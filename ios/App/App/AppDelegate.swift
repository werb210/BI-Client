import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { BorealRiskPushCategories.register(); return true }
    // BI_CLIENT_BACKGROUND_SYNC_v308 - iOS relaunches the app to report finished background sends.
    func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
        if identifier == BackgroundSender.sessionIdentifier {
            BackgroundSender.shared.systemCompletion = completionHandler
            _ = BackgroundSender.shared.session
        } else {
            completionHandler()
        }
    }
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

// BI_CLIENT_BACKGROUND_SYNC_v308
// A background URLSession sends prepared requests (the contract upload and
// saved answers) after the app is closed; iOS retries when the connection
// returns. The web layer builds each request body; this only sends it and
// records the HTTP status for the app to read the next time it opens.
final class BackgroundSender: NSObject, URLSessionTaskDelegate {
    static let shared = BackgroundSender()
    static let sessionIdentifier = "com.boreal.risk.client.background-sync"
    var systemCompletion: (() -> Void)?
    private let resultsKey = "boreal.backgroundSync.results"
    private let lock = NSLock()

    lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: BackgroundSender.sessionIdentifier)
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("BackgroundSync", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func enqueue(id: String, url: URL, method: String, contentType: String, body: Data, headers: [String: String]) throws {
        let bodyFile = directory.appendingPathComponent("\(id).body")
        try body.write(to: bodyFile, options: .atomic)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        let task = session.uploadTask(with: request, fromFile: bodyFile)
        task.taskDescription = id
        task.resume()
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription else { return }
        let status = error == nil ? ((task.response as? HTTPURLResponse)?.statusCode ?? 0) : 0
        lock.lock()
        var all = UserDefaults.standard.dictionary(forKey: resultsKey) ?? [:]
        all[id] = status
        UserDefaults.standard.set(all, forKey: resultsKey)
        lock.unlock()
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("\(id).body"))
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.systemCompletion?()
            self.systemCompletion = nil
        }
    }

    func results() -> [[String: Any]] {
        lock.lock(); defer { lock.unlock() }
        let all = UserDefaults.standard.dictionary(forKey: resultsKey) ?? [:]
        return all.map { key, value in ["id": key, "status": value as? Int ?? 0] }
    }

    func acknowledge(_ ids: [String]) {
        lock.lock(); defer { lock.unlock() }
        var all = UserDefaults.standard.dictionary(forKey: resultsKey) ?? [:]
        for id in ids { all.removeValue(forKey: id) }
        UserDefaults.standard.set(all, forKey: resultsKey)
    }

    func cancelAll() {
        session.getAllTasks { tasks in tasks.forEach { $0.cancel() } }
        try? FileManager.default.removeItem(at: directory)
        lock.lock(); defer { lock.unlock() }
        UserDefaults.standard.removeObject(forKey: resultsKey)
    }
}

@objc(BackgroundSyncPlugin)
public class BackgroundSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackgroundSyncPlugin"
    public let jsName = "BackgroundSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enqueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "results", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise)
    ]

    @objc func enqueue(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let urlString = call.getString("url"), let url = URL(string: urlString),
              let bodyBase64 = call.getString("bodyBase64"), let body = Data(base64Encoded: bodyBase64) else {
            call.reject("id, url and bodyBase64 are required"); return
        }
        let headers = (call.getObject("headers") ?? [:]).compactMapValues { $0 as? String }
        do {
            try BackgroundSender.shared.enqueue(id: id, url: url, method: call.getString("method") ?? "POST", contentType: call.getString("contentType") ?? "application/json", body: body, headers: headers)
            call.resolve()
        } catch {
            call.reject("Could not start the background send")
        }
    }

    @objc func results(_ call: CAPPluginCall) { call.resolve(["results": BackgroundSender.shared.results()]) }

    @objc func acknowledge(_ call: CAPPluginCall) {
        BackgroundSender.shared.acknowledge(call.getArray("ids", String.self) ?? [])
        call.resolve()
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        BackgroundSender.shared.cancelAll()
        call.resolve()
    }
}
