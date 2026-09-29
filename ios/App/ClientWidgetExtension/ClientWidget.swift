// BI_CLIENT_BLOCK_v603_HOME_WIDGET + BI_CLIENT_WIDGET_BRAND_v631
// Boreal Risk home-screen widget: brand header (navy, mountain mark), the application's
// stage, and a plain action line - "Upload 1 document", "Answer 2 questions" or "Nothing to do".
import WidgetKit
import SwiftUI

private let suite = "group.com.boreal.risk.client"
let borealNavy = Color(red: 11 / 255, green: 31 / 255, blue: 58 / 255)
let borealGold = Color(red: 201 / 255, green: 162 / 255, blue: 74 / 255)
let borealGreen = Color(red: 134 / 255, green: 219 / 255, blue: 157 / 255)

struct ClientEntry: TimelineEntry { let date: Date; let stage: String; let toDoCount: Int; let action: String }

struct ClientProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClientEntry { ClientEntry(date: .now, stage: "Application in progress", toDoCount: 1, action: "Upload 1 document") }
    func getSnapshot(in context: Context, completion: @escaping (ClientEntry) -> Void) { completion(read()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ClientEntry>) -> Void) {
        Task { // BI_CLIENT_WIDGET_SELF_REFRESH_v675
            await RiskWidgetRefresher.refresh()
            completion(Timeline(entries: [read()], policy: .after(Date().addingTimeInterval(30 * 60))))
        }
    }
    private func read() -> ClientEntry {
        let defaults = UserDefaults(suiteName: suite)
        let count = defaults?.integer(forKey: "todo_count") ?? 0
        let stored = defaults?.string(forKey: "action") ?? ""
        let fallback = count == 0 ? "Nothing to do" : (count == 1 ? "1 thing to do" : "\(count) things to do")
        return ClientEntry(date: .now,
                           stage: defaults?.string(forKey: "stage") ?? "Application in progress",
                           toDoCount: count,
                           action: stored.isEmpty ? fallback : stored)
    }
}

struct ClientWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ClientEntry
    var body: some View {
        if family == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 1) {
                Text("Boreal Risk").font(.headline)
                Text(entry.stage).lineLimit(1)
                Text(entry.action).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(URL(string: "borealrisk://home"))
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "mountain.2.fill").font(.caption.bold())
                    Text("Boreal Risk").font(.caption.bold())
                }
                .foregroundStyle(Color.white)
                Text("STAGE").font(.system(size: 10, weight: .semibold)).foregroundStyle(Color.white.opacity(0.6)).padding(.top, 4)
                Text(entry.stage).font(.headline).foregroundStyle(Color.white).lineLimit(2)
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    Image(systemName: entry.toDoCount > 0 ? "arrow.up.doc.fill" : "checkmark.circle.fill")
                    Text(entry.action).lineLimit(2)
                }
                .font(.subheadline.bold())
                .foregroundStyle(entry.toDoCount > 0 ? borealGold : borealGreen)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .widgetURL(URL(string: "borealrisk://home"))
        }
    }
}

struct ClientWidget: Widget {
    let kind = "BorealClientWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClientProvider()) { entry in
            ClientWidgetView(entry: entry).containerBackground(borealNavy, for: .widget)
        }
        .configurationDisplayName("Application status")
        .description("Your stage and what you need to do next.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

@main struct ClientWidgetBundle: WidgetBundle { var body: some Widget { ClientWidget() } }

// BI_CLIENT_WIDGET_SELF_REFRESH_v675 - the widget checks the applicant's to-do list on BI-Server
// itself every 30 minutes (while the one-hour sign-in is still valid), so a new request shows
// without opening the app.
enum RiskWidgetRefresher {
    static func actionLine(_ items: [[String: Any]]) -> String {
        let docs = items.filter { ($0["kind"] as? String) == "document" }.count
        let questions = items.filter { ($0["kind"] as? String) == "question" }.count
        var parts: [String] = []
        if docs > 0 { parts.append(docs == 1 ? "Upload 1 document" : "Upload \(docs) documents") }
        if questions > 0 { parts.append(questions == 1 ? "Answer 1 question" : "Answer \(questions) questions") }
        return parts.isEmpty ? "Nothing to do" : parts.joined(separator: " \u{00B7} ")
    }

    static func refresh() async {
        guard let defaults = UserDefaults(suiteName: suite),
              let id = defaults.string(forKey: "application_id"), !id.isEmpty,
              let token = defaults.string(forKey: "token"), !token.isEmpty,
              var api = defaults.string(forKey: "api_url"), !api.isEmpty else { return }
        while api.hasSuffix("/") { api.removeLast() }
        let path = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        guard let url = URL(string: api + "/applicants/action-center/" + path) else { return }
        var req = URLRequest(url: url, timeoutInterval: 10)
        req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        guard let result = try? await URLSession.shared.data(for: req) else { return }
        let (data, resp) = result
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { defaults.removeObject(forKey: "token"); return }
        guard status == 200, let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let body = (obj["data"] as? [String: Any]) ?? obj
        let items = body["outstanding"] as? [[String: Any]] ?? []
        let count = (body["outstandingCount"] as? Int) ?? items.count
        defaults.set(max(0, min(99, count)), forKey: "todo_count")
        defaults.set(actionLine(items), forKey: "action")
    }
}
