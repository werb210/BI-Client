// BI_CLIENT_BLOCK_v603_HOME_WIDGET
import WidgetKit
import SwiftUI

private let suite = "group.com.boreal.risk.client"
struct ClientEntry: TimelineEntry { let date: Date; let stage: String; let toDoCount: Int }
struct ClientProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClientEntry { ClientEntry(date: .now, stage: "Application in progress", toDoCount: 0) }
    func getSnapshot(in context: Context, completion: @escaping (ClientEntry) -> Void) { completion(read()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ClientEntry>) -> Void) { completion(Timeline(entries: [read()], policy: .never)) }
    private func read() -> ClientEntry { let defaults = UserDefaults(suiteName: suite); return ClientEntry(date: .now, stage: defaults?.string(forKey: "stage") ?? "Application in progress", toDoCount: defaults?.integer(forKey: "todo_count") ?? 0) }
}
struct ClientWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ClientEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("BOREAL RISK").font(.caption2.bold()).foregroundStyle(.blue)
            Text(entry.stage).font(family == .accessoryRectangular ? .caption.bold() : .headline).lineLimit(2)
            Text(entry.toDoCount == 0 ? "Nothing to do" : "\(entry.toDoCount) item\(entry.toDoCount == 1 ? "" : "s") to do").font(.caption)
        }.widgetURL(URL(string: "borealrisk://home"))
    }
}
struct ClientWidget: Widget {
    let kind = "BorealClientWidget"
    var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: ClientProvider()) { ClientWidgetView(entry: $0).containerBackground(.fill.tertiary, for: .widget) }.configurationDisplayName("Application status").description("Your stage and items still to do.").supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular]) }
}
@main struct ClientWidgetBundle: WidgetBundle { var body: some Widget { ClientWidget() } }
