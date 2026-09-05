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
            // The list's own box, which both the rows and the sentence that stands in for them
            // are inset from — the design's `#rows`. Each of them then takes its own inset inside
            // it, so an empty list starts exactly where a row's name would have.
            rows
                .padding(.horizontal, ArgoSpacing.base)
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

    /// The reader's question, read once for the two lines that are worded by whether one was
    /// asked at all. One value rather than two constructions: the rule lives in `AtlasSearch`, and
    /// the count and the empty sentence must never disagree about whether anything was typed.
    private var search: AtlasSearch {
        AtlasSearch(query)
    }

    /// `found` where a question was asked and not where one was not: a reader who has typed
    /// nothing has found nothing, they are looking at the whole repository.
    private var count: String {
        let files = "\(entries.count) file\(entries.count == 1 ? "" : "s")"
        return search.isAsking ? "\(files) found" : files
    }

    @ViewBuilder private var rows: some View {
        if entries.isEmpty {
            // Said rather than shown: an empty box is a list that might still be loading, and both
            // of these are answers already given. WHICH answer depends on whether the reader
            // asked anything — telling someone their words matched nothing when they typed none is
            // the same list saying two different things about itself.
            Text(
                search.isAsking
                    ? "Nothing here matches all of those words."
                    : "The map is drawing no files.",
            )
            .argoText(ArgoTypography.body)
            // The label above it, not louder: a sentence saying a list is empty must not be the
            // brightest thing in the column.
            .foregroundStyle(argo.color.text.tertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Flush with the row names above, which take the same inset from inside the same
            // region — a sentence that stands in for the rows must start where they start.
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.base)
        } else {
            // **A marked row nobody can see is not a selected row.** The map is picked with a
            // pointer and this list holds every file in the repository, so a box clicked near the
            // middle of the map marks a row hundreds down. The ticket's "picking a file on the map
            // selects its row in the list" is a claim about what the reader can SEE, and a ground
            // painted off screen answers half of it.
            //
            // Driven by a CHANGE of what is open, never by a value the list reads back: where the
            // reader has scrolled to by hand is theirs, and a position bound to the open file
            // would take the scroller off them for as long as one is open.
            ScrollViewReader { rows in
                ScrollView(.vertical) {
                    LazyVStack(spacing: ArgoSpacing.flush) {
                        ForEach(entries, id: \.path) { entry in
                            AtlasFileRow(
                                entry: entry,
                                isOpen: entry.path == open,
                                select: { select(entry.path) },
                            )
                            .id(entry.path)
                        }
                    }
                    .padding(.bottom, ArgoSpacing.comfortable)
                }
                .onChange(of: open) { reveal(open, in: rows) }
                // The list is rebuilt when the question changes, and a row scrolled to before the
                // rebuild is a row at another offset after it.
                .onChange(of: entries.count) { reveal(open, in: rows) }
            }
        }
    }

    /// Scrolls the open row into the middle of the list, or does nothing where there is no open
    /// row to scroll to — which is both "nothing is open" and "the question has narrowed the list
    /// past what is".
    private func reveal(_ path: String?, in rows: ScrollViewProxy) {
        guard let path, entries.contains(where: { $0.path == path }) else { return }
        rows.scrollTo(path, anchor: .center)
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
