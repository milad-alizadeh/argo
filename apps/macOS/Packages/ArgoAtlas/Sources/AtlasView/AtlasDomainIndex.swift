import ArgoDesign
import AtlasLayout
import SwiftUI

/// THE INDEX OF SUBJECTS. Every region a domain map is drawing, in one list (#1158, the approved
/// design's `domainRows`).
///
/// **One line each, and each one a way in.** The list is how a reader gets from a name they are
/// curious about to the place it lives, which pointing at the map cannot do — and a subject spread
/// over five folders is invisible in a tree and is one row with a count here.
///
/// It stands where `AtlasIndex` stands and answers the same question the folder rail answers in
/// the other reading: a rail indexing files beside a map tiled by subject is answering a question
/// nobody asked.
public struct AtlasDomainIndex: View {
    /// The partition as the reader's question leaves it. One value rather than three parameters,
    /// because they are one reading and the head is worded from all three at once.
    private let listing: AtlasDomainListing

    private let wheel: ArgoPalette.DomainWheel

    /// Go to a region. The same verb a click on its plate is (`AtlasDescent.enter`), because they
    /// are one move to one place rather than two moves that could drift apart.
    private let enter: (String) -> Void

    public init(
        listing: AtlasDomainListing,
        wheel: ArgoPalette.DomainWheel,
        enter: @escaping (String) -> Void,
    ) {
        self.listing = listing
        self.wheel = wheel
        self.enter = enter
    }

    private var entries: [AtlasDomainEntry] {
        listing.entries
    }

    public var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            head
            rows
                .padding(.horizontal, ArgoSpacing.base)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .contain)
    }

    /// What the head says, in the two sentences the list has.
    ///
    /// **Never both counts at once where a question is being asked.** `entries` is narrowed by the
    /// reader's words and the unassigned count is a fact about the whole map, so printing them
    /// together under a question reads as "one domain leaves twelve files over" — which is not
    /// what either number means. Asking, the head reports only what was found, the way the file
    /// index beside it does.
    private var count: String {
        let domains = "\(entries.count) domain\(entries.count == 1 ? "" : "s")"
        guard !AtlasSearch(listing.query).isAsking else { return "\(domains) found" }
        let loose = listing.unassigned
        return "\(domains) · \(loose) file\(loose == 1 ? "" : "s") in none"
    }

    /// How many subjects there are, and how much of the repository is in none of them. The second
    /// half is the honest one: a partition that placed a fifth of the files nowhere is a partition
    /// the reader has to be told about, in the same breath as the count that looks impressive.
    private var head: some View {
        Text(count)
            .textCase(.uppercase)
            .argoLine(ArgoTypography.machineCaption, .sectionHeader)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ArgoSpacing.loose)
            .padding(.top, ArgoSpacing.comfortable)
            .padding(.bottom, ArgoSpacing.snug)
    }

    @ViewBuilder private var rows: some View {
        if entries.isEmpty {
            // Said rather than shown, for `AtlasIndex`'s reason: an empty box is a list that might
            // still be loading, and this is an answer already given.
            Text("Nothing here matches all of those words.")
                .argoLine(ArgoTypography.body, .metadata)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.vertical, ArgoSpacing.base)
        } else {
            ScrollView(.vertical) {
                LazyVStack(spacing: ArgoSpacing.flush) {
                    ForEach(entries, id: \.path) { entry in
                        AtlasDomainRow(
                            entry: entry,
                            swatch: wheel.hue(entry.rank, confidence: entry.confidence),
                            enter: { enter(entry.path) },
                        )
                    }
                }
                .padding(.bottom, ArgoSpacing.comfortable)
            }
        }
    }
}

/// What the list of subjects is showing: the question that narrowed it, the regions that answered,
/// and how many files the inference placed in none (#1158).
///
/// One value because the head is worded from all three at once — a count of regions is a different
/// sentence depending on whether a question was asked, and the count of files in none belongs to
/// the whole map rather than to what the question left. Split into parameters they arrive at the
/// list as three facts nothing says are about one reading.
public struct AtlasDomainListing {
    /// What the reader asked. Read rather than written: the field stands above this list, and what
    /// is left here is the one line whose WORDING depends on whether a question was asked at all.
    public let query: String

    /// The regions that answered it, largest first.
    public let entries: [AtlasDomainEntry]

    /// How many files the inference placed in nothing. In the HEAD rather than as a row: the
    /// unassigned region is on the map, where a reader can see how much of the repository it is,
    /// but it is not a subject and a list of subjects that named it would be claiming a guess
    /// nobody made.
    public let unassigned: Int

    public init(query: String, entries: [AtlasDomainEntry], unassigned: Int) {
        self.query = query
        self.entries = entries
        self.unassigned = unassigned
    }
}

/// One region in the list beside a domain map (the design's own `.drow`): the colour it is drawn
/// in, what it is called, and how many files are in it.
///
/// The swatch is painted from the SAME call the region's roofs are, at the same rank and the same
/// confidence — which is what keeps a swatch and the region it stands for from drifting apart.
struct AtlasDomainRow: View {
    @Environment(\.argo) private var argo

    let entry: AtlasDomainEntry
    let swatch: ArgoColor
    let enter: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: enter) {
            HStack(spacing: ArgoSpacing.base) {
                Rectangle()
                    .fill(swatch)
                    .frame(width: Self.swatchSide, height: Self.swatchSide)
                    .clipShape(RoundedRectangle(cornerRadius: ArgoRadius.marker))
                Text(entry.name)
                    .argoLine(ArgoTypography.rowTitle, .title)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: ArgoSpacing.base)
                Text(entry.count.formatted(.number))
                    .argoLine(ArgoTypography.machineCaption, .machineFact)
            }
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.snug)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .background(ground, in: RoundedRectangle(cornerRadius: ArgoRadius.control))
        .onHover { isHovered = $0 }
        // The tier, said on the row a reader points at: every other list in this app indexes
        // something measured, and this one indexes a guess.
        .help("\(entry.name) — \(entry.count) files, inferred")
        .accessibilityLabel("\(entry.name), \(entry.count) files, inferred domain")
    }

    /// The ground is the whole of the mark, which is this app's own rule — and hover is the only
    /// rung a region row has: nothing here is OPEN the way a file is, because entering a region
    /// re-tiles the map rather than reading something beside it.
    private var ground: Color {
        isHovered ? argo.color.surface.hover.color : .clear
    }

    /// The swatch's side — the design's own 9, which is the smallest square the eye reads a hue
    /// off at this rung.
    private static let swatchSide: CGFloat = 9
}

/// The committed measurement's own nine, at their own confidences — so the list is seen with the
/// washed-out end of the wheel in it rather than nine regions we are all equally sure of.
private let previewRegions: [AtlasDomainEntry] = [
    ("evidence", 0.86, 14), ("media", 0.71, 11), ("entities", 0.64, 11),
    ("session", 0.52, 10), ("fixtures", 0.48, 9), ("slash", 0.44, 9),
    ("syntax", 0.33, 6), ("atlas", 0.22, 4), ("plus", 0.12, 3),
].enumerated().map { rank, region in
    AtlasDomainEntry(
        path: "argo/\(region.0)",
        rank: rank,
        confidence: region.1,
        count: region.2,
    )
}

private struct AtlasDomainIndexPreview: View {
    @Environment(\.argo) private var argo

    var query = ""
    var entries = previewRegions
    var unassigned = 12

    var body: some View {
        AtlasDomainIndex(
            listing: AtlasDomainListing(
                query: query, entries: entries, unassigned: unassigned,
            ),
            wheel: argo.color.atlas.domain,
            enter: { _ in },
        )
        .frame(width: 356, height: 420)
        // The rail's own ground, which the list is drawn on and never carries itself.
        .background(argo.color.surface.sunken.color)
    }
}

#Preview("Atlas domain index — every subject the inference found") {
    AtlasDomainIndexPreview().argoAppearance()
}

#Preview("Atlas domain index — a question with one answer") {
    AtlasDomainIndexPreview(query: "entities", entries: [previewRegions[2]]).argoAppearance()
}

#Preview("Atlas domain index — a question nothing answers") {
    AtlasDomainIndexPreview(query: "kubernetes", entries: []).argoAppearance()
}
