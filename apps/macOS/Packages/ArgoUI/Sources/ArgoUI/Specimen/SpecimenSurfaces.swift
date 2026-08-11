import SwiftUI

// The harness views the catalog's cases are drawn through — the stand-ins a state needs when the
// shipping surface cannot be reached from a screenshot.

/// Every operational state a roster row can be in, in one column — the SHIPPING row, over the
/// sidebar list it ships inside, projected from the same presentation the shell is handed.
struct SessionRowsSpecimen: View {
    var body: some View {
        List {
            ForEach(SessionRosterProjection.previewRows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

/// The shell against a roster that MIXES access — a ghosted row inside the whole window rather
/// than in a list on its own. `ghostedRows` is the close read of the same claim.
struct RosterSpecimen: View {
    /// Which roster the shell is drawn against.
    var presentation: CockpitPresentation = .preview

    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: presentation, actions: .inert)
            .environment(navigation)
    }
}

/// The window chrome alone, against an empty plane. `toolbarScope` draws the New Session button
/// live beside a Project, `emptyToolbarScope` draws the same control disabled on a machine that has
/// registered nothing.
struct ToolbarSpecimen: View {
    let presentation: CockpitPresentation

    @State private var room = CockpitRoom.sessions
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        Color.clear
            .toolbar {
                ShellToolbar(
                    room: $room,
                    presentation: presentation,
                    actions: .inert,
                    spawn: CockpitSpawn(
                        presentation: presentation,
                        actions: .inert,
                        navigation: navigation,
                    ),
                )
            }
            .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}

/// The drawer in a REAL popover, opened on appear. A popover is its own window with its own
/// environment, and the row's body came apart inside one while rendering fine outside it — which
/// `DrawerSpecimen`, drawing the content directly, cannot catch.
struct OpenDrawerSpecimen: View {
    @State private var isOpen = false

    var body: some View {
        ProjectVessel(presentation: .preview, actions: .inert)
            .padding(ArgoSpacing.region)
            .onAppear { isOpen = true }
            .popover(isPresented: $isOpen, arrowEdge: .bottom) {
                ProjectDrawer(presentation: .preview, actions: .inert)
            }
    }
}

/// The drawer as it hangs off the vessel: over the window's own ground, at its own width, rather
/// than filling the frame. A popover is a window of its own and never lands in a screenshot of
/// this one, so the harness draws the content directly.
struct DrawerSpecimen: View {
    @Environment(\.argo) private var argo

    let presentation: CockpitPresentation

    var body: some View {
        // In a popover the panel is the system's own material and the drawer must add nothing;
        // this specimen has no popover to sit in, so it stands in for one.
        ProjectDrawer(presentation: presentation, actions: .inert)
            .glassEffect(in: .rect(cornerRadius: ArgoRadius.popover))
            .padding(ArgoSpacing.region)
    }
}

/// A reading that is still being WRITTEN, for the one claim no stopped fixture can carry: a row
/// arriving at the end must not drag a reader who has scrolled up away from the line they are on.
///
/// Half the fixture on screen, the rest arriving a few rows at a time. The two numbers are a pace:
/// a `step` arrives as one batch — the run of rows in quick succession a feed must follow without
/// easing once per line — and the whole write must run several SECONDS, or it finishes during the
/// launch and leaves the reader nothing to do between two arrivals.
struct ArrivingFeedSpecimen: View {
    private static let step = 6
    private static let beat = Duration.milliseconds(300)

    @State private var written = FeedProjection.longRows.count / 2

    var body: some View {
        InstrumentDeckShell(room: .sessions, feed: Array(FeedProjection.longRows.prefix(written)))
            .task {
                while written < FeedProjection.longRows.count {
                    try? await Task.sleep(for: Self.beat)
                    // Cancellation is the only thing `sleep` throws, and swallowing it without
                    // asking would spin this loop as fast as the window can draw.
                    guard !Task.isCancelled else { return }
                    written = min(written + Self.step, FeedProjection.longRows.count)
                }
            }
    }
}

/// The ⓘ panel's content, stood in a glass of its own — the same stand-in `DrawerSpecimen` makes,
/// because a popover is a window of its own and never lands in a screenshot of this one.
struct ContextGuideSpecimen: View {
    var body: some View {
        SessionContextGuide()
            .glassEffect(in: .rect(cornerRadius: ArgoRadius.popover))
            .padding(ArgoSpacing.region)
    }
}

/// The deck specimen, holding the tab selection it needs to draw.
struct DeckSpecimen: View {
    @State private var tab = SpecimenFixtures.DeckTab.activity

    var body: some View {
        SpecimenDeck(session: .preview, tab: $tab)
    }
}
