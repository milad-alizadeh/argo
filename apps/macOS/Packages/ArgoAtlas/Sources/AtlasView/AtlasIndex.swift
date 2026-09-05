import ArgoDesign
import AtlasLayout
import SwiftUI

/// THE INDEX. Every file the map is drawing, in one list, and the search that narrows it (#1155,
/// the approved design's `AtlasIndex`).
///
/// **A mark on a roof tells you where to look; this tells you what there is to look at.** Both are
/// needed, which is why the list is a permanent region of the rail rather than something a search
/// summons: a reader who does not know the repository cannot point at the file they are after.
///
/// The list and the map are read off ONE Map by one rule (`AtlasMap.index(matching:by:)`), and the
/// row a reader picks is the file the map traces — so the two can never disagree about what is in
/// the repository or about which file is open.
public struct AtlasIndex: View {
    @Environment(\.argo) private var argo

    @Binding private var query: String
    private let entries: [AtlasIndexEntry]
    private let open: String?
    private let select: (String) -> Void

    public init(
        query: Binding<String>,
        entries: [AtlasIndexEntry],
        open: String?,
        select: @escaping (String) -> Void,
    ) {
        _query = query
        self.entries = entries
        self.open = open
        self.select = select
    }

    public var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            AtlasFind(query: $query)
                .padding(.horizontal, ArgoSpacing.loose)
                .padding(.top, ArgoSpacing.comfortable)
            head
            rows
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .contain)
    }

    /// How many files the list is holding — the ticket's own criterion, and the one line that
    /// tells a reader whether a question narrowed anything.
    private var head: some View {
        Text(count)
            .textCase(.uppercase)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ArgoSpacing.loose)
            .padding(.top, ArgoSpacing.comfortable)
            .padding(.bottom, ArgoSpacing.snug)
    }

    /// `found` where a question was asked and not where one was not: a reader who has typed
    /// nothing has found nothing, they are looking at the whole repository.
    private var count: String {
        let files = "\(entries.count) file\(entries.count == 1 ? "" : "s")"
        return AtlasSearch(query).isAsking ? "\(files) found" : files
    }

    @ViewBuilder private var rows: some View {
        if entries.isEmpty {
            // Said rather than shown: an empty box is a list that might still be loading, and this
            // is a question that has already been answered.
            Text("Nothing here matches all of those words.")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.base)
        } else {
            ScrollView(.vertical) {
                LazyVStack(spacing: ArgoSpacing.flush) {
                    ForEach(entries, id: \.path) { entry in
                        AtlasFileRow(
                            entry: entry,
                            isOpen: entry.path == open,
                            select: { select(entry.path) },
                        )
                    }
                }
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.bottom, ArgoSpacing.comfortable)
            }
        }
    }
}

/// A handful of files across two folders, one of them measured for nothing — the three things a
/// row has to survive: a long path, a short one, and a missing figure.
private let previewEntries = [
    AtlasIndexEntry(
        path: "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/CockpitView.swift",
        name: "CockpitView.swift",
        folder: "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell",
        value: 47,
    ),
    AtlasIndexEntry(
        path: "argo/apps/macOS/Packages/ArgoAtlas/Sources/AtlasView/AtlasView.swift",
        name: "AtlasView.swift",
        folder: "argo/apps/macOS/Packages/ArgoAtlas/Sources/AtlasView",
        value: 12,
    ),
    AtlasIndexEntry(path: "argo/README.md", name: "README.md", folder: "argo", value: 4),
    AtlasIndexEntry(
        path: "argo/docs/designs/at-filter.png",
        name: "at-filter.png",
        folder: "argo/docs/designs",
        value: nil,
    ),
]

private struct AtlasIndexPreview: View {
    @Environment(\.argo) private var argo

    @Binding var query: String
    var entries = previewEntries
    var open: String?

    var body: some View {
        AtlasIndex(query: $query, entries: entries, open: open) { _ in }
            .frame(width: 356, height: 420)
            // The rail's own ground, which the index is drawn on and never carries itself: the
            // list is a region of a column, not a card.
            .background(argo.color.surface.sunken.color)
    }
}

#Preview("Atlas index — the whole repository") {
    @Previewable @State var query = ""

    AtlasIndexPreview(query: $query).argoAppearance()
}

#Preview("Atlas index — a file open") {
    @Previewable @State var query = ""

    AtlasIndexPreview(query: $query, open: "argo/README.md").argoAppearance()
}

#Preview("Atlas index — a question with answers") {
    @Previewable @State var query = "atlas swift"

    AtlasIndexPreview(query: $query, entries: [previewEntries[1]]).argoAppearance()
}

#Preview("Atlas index — a question nothing answers") {
    @Previewable @State var query = "kubernetes"

    AtlasIndexPreview(query: $query, entries: []).argoAppearance()
}
