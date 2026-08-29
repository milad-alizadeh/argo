import SwiftUI

/// The feed with the state the deck normally owns, for the surfaces that draw it alone.
///
/// `FeedView` deliberately owns none of what a row opens — the panel resizes the column, the
/// lightbox covers the deck, and focus has to be able to come back out of both. That makes it
/// unpreviewable on its own, and a preview that handed it three constants would be looking at a
/// feed where nothing opens. This holds the real state instead, so a `#Preview` exercises the same
/// paths the shell does.
struct FeedPreview: View {
    private static let landingTries = 20
    private static let landingBeat = Duration.milliseconds(25)

    let rows: [FeedRow]

    /// Whether the overview lane is drawn beside the reading, as the deck draws it. Off by default:
    /// most of these previews are looking at a row, and a lane beside one is a second thing to
    /// read.
    var showsOverview = false

    /// Which Turn the lane beside the reading is naming. Set after building rather than through
    /// the initialiser, because it is a state only a still needs and every other caller wants the
    /// lane the running app draws.
    var naming: MinimapNaming = .nothing

    /// Which row the reading opens held at — as though the reader had scrolled up to it. The only
    /// way to a detached reading in a still, and the only way to put the lane's viewport rectangle
    /// anywhere but at the foot of the lane.
    var held: FeedRow.ID?

    /// Which prompts the reading opens unfolded — see `FeedView.opensUnfolded`. Set after building
    /// for the reason `naming` is: it is a state only a still needs.
    var opensUnfolded: Set<FeedRow.ID> = []

    /// Which row the reading opens with the keyboard cursor on. Set after building, for the reason
    /// `naming` is: the cursor arrives with an arrow key and a still cannot press one, so this is
    /// the only way to look at the ring #533 asked for.
    var cursor: FeedRow.ID?

    /// Which row's evidence the preview opens on. A settable initial state for the same reason
    /// `SessionsDeck` takes one: the state belongs to the surface, and there is no other way to
    /// reach it without a click.
    @State private var open: FeedRow.ID?
    @State private var step: Int?
    @State private var lit: FeedShot?
    @FocusState private var focus: FeedFocus?
    /// The one handle both surfaces hold — see `FeedTableHandle`. Seeded with `held`, so a still
    /// shows the detached state from its first frame.
    @State private var table: FeedTableHandle

    init(
        rows: [FeedRow],
        showsOverview: Bool = false,
        held: FeedRow.ID? = nil,
        open: FeedRow.ID? = nil,
    ) {
        self.rows = rows
        self.showsOverview = showsOverview
        self.held = held
        _open = State(initialValue: open)
        _table = State(initialValue: FeedTableHandle(held: held))
    }

    var body: some View {
        // The lane is a share of what it and the feed have between them, so it is measured rather
        // than given a number. No rail here, so the whole width is that span.
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                FeedView(
                    rows: rows,
                    selection: FeedRowSelection(
                        open: $open, step: $step, lit: $lit, focus: $focus,
                    )
                    .homing(onto: table),
                    held: held,
                    table: table,
                    opensUnfolded: opensUnfolded,
                )
                if showsOverview {
                    DeckSeparator()
                    MinimapLane(feed: table, naming: naming)
                        .frame(width: ArgoLayout.minimapLaneWidth(sharing: proxy.size.width))
                }
            }
        }
        .argoDeckSurface()
        .argoAppearance()
        // The table's own way in, not a back door: this is the call the deck makes when it hands
        // the keyboard back to a row. Both halves of the state have to be stated — the reader
        // arrived by KEY, which is what the cursor is gated on, and a still cannot press one.
        .task { await seedCursor() }
    }

    /// After the reading's opening landing, never before it: that scroll would otherwise overwrite
    /// the cursor's own and the still would come out at whatever row the feed opens on. Bounded
    /// rather than a spin, so a reading that never settles yields a wrong still and not a hang.
    private func seedCursor() async {
        guard let cursor else { return }
        ArgoFocusVisibility.shared.note(.keyDown)
        for _ in 0 ..< Self.landingTries where table.isOpeningOwed {
            try? await Task.sleep(for: Self.landingBeat)
        }
        table.focus(onto: cursor)
    }
}
