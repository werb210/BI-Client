// BI_CLIENT_BLOCK_v091_VISIONKIT_SCANNER_v1
// See BF-client v205. @capacitor-mlkit/document-scanner has no Package.swift, so
// `cap sync ios` reports "not compatible with SPM" and drops it. VisionKit is
// Apple's own scanner: no dependency, no SPM problem, identical JS contract.
import Foundation
import Capacitor
import VisionKit
import UIKit

@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DocumentScannerPlugin"
    public let jsName = "DocumentScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scanDocument", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var pageLimit: Int = 10

    @objc func scanDocument(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Document scanning is not supported on this device"); return
        }
        pageLimit = max(1, call.getInt("pageLimit") ?? 10)
        pendingCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            self.bridge?.viewController?.present(scanner, animated: true)
        }
    }

    private func persist(_ scan: VNDocumentCameraScan) throws -> [String] {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("boreal-scans", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var urls: [String] = []
        for index in 0..<min(scan.pageCount, pageLimit) {
            guard let data = scan.imageOfPage(at: index).jpegData(compressionQuality: 0.9) else { continue }
            let url = dir.appendingPathComponent("page-\(UUID().uuidString).jpg")
            try data.write(to: url, options: .atomic)
            urls.append(url.absoluteString)
        }
        return urls
    }
}

extension DocumentScannerPlugin: VNDocumentCameraViewControllerDelegate {
    public func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                             didFinishWith scan: VNDocumentCameraScan) {
        let call = pendingCall; pendingCall = nil
        controller.dismiss(animated: true)
        do { call?.resolve(["scannedImages": try persist(scan)]) }
        catch { call?.reject("Unable to save scanned pages") }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        let call = pendingCall; pendingCall = nil
        controller.dismiss(animated: true)
        call?.resolve(["scannedImages": []])
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                             didFailWithError error: Error) {
        let call = pendingCall; pendingCall = nil
        controller.dismiss(animated: true)
        call?.reject("Scan failed")
    }
}
