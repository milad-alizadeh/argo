import SwiftUI

// The harness views the catalog's cases are drawn through — the stand-ins a state needs when the
// shipping surface cannot be reached from a screenshot: a list to hold a row, a window to hang a
// popover off, a container holding the one piece of state its content reads.
//
// Split from `SpecimenCatalog` because they answer a different question. That file is the LIST of
// renderable states, read by `scripts/specimens.sh`; this one is how three of them get on screen.

/// Every operational state a roster row can be in, in one column — the SHIPPING row, over the
/// sidebar list it ships inside, projected from the same presentation the shell is handed. A
/// specimen drawing a second row is evidence about a row nobody sees.
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

/// The shell against a roster that MIXES access. The lock is drawn only where read-only tells
/// rows apart, so a uniform roster suppresses it by design and this is the only way to look at it.
struct RosterSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: .preview, actions: .inert)
            .environment(navigation)
    }
}

/// The window chrome alone, against an empty plane. One merged capsule at the leading edge and one
/// pinned to the trailing edge is a claim about the toolbar, which the shell specimens bury under
/// everything else in the frame.
struct ToolbarSpecimen: View {
    let presentation: CockpitPresentation

    @State private var room = CockpitRoom.sessions

    var body: some View {
        Color.clear
            .toolbar {
                ShellToolbar(room: $room, presentation: presentation, actions: .inert)
            }
            .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}

/// The drawer in a REAL popover, opened on appear.
///
/// `DrawerSpecimen` draws the content directly, which renders it but never puts it in the context
/// it actually lives in — and that context is where it failed: a popover is its own window with
/// its own environment, and the row's body came apart inside one while rendering fine outside it.
/// This case is how that is caught by rendering rather than by a person clicking.
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
        // The glass belongs HERE, not in the drawer. In a popover the panel is the system's own
        // material and the drawer must add nothing; this specimen has no popover to sit in, so it
        // stands in for one.
        ProjectDrawer(presentation: presentation, actions: .inert)
            .glassEffect(in: .rect(cornerRadius: ArgoRadius.popover))
            .padding(ArgoSpacing.region)
    }
}

/// A reading that is still being WRITTEN, for the one claim no stopped fixture can carry: a row
/// arriving at the end must not drag a reader who has scrolled up away from the line they are on.
///
/// Half the fixture on screen and the rest arriving a dozen rows at a time. Both halves are
/// load-bearing — a feed that had finished growing before anything scrolled into it would be a
/// static specimen with extra steps, and a feed that grew in one jump would never overlap a read.
///
/// The rest of it lands inside a few seconds. Whoever is watching has to be able to wait for the
/// growing to be OVER: a claim that the reader was not moved is worth nothing against a reading
/// that might simply not have grown yet.
///
/// A few seconds and not a fraction of one, which is the load-bearing half of the pace. Every claim
/// about a reading that is being written is a claim about something a reader DID between two rows
/// arriving — scrolled up, scrolled back down — and a fixture that finishes writing during the
/// launch leaves nothing to do that in. Whatever asserts against this specimen would then be
/// asserting against a stopped one and reading as though it had covered a live one.
struct ArrivingFeedSpecimen: View {
    private static let step = 6
    private static let beat = Duration.milliseconds(500)

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

/// The deck specimen, holding the tab selection it needs to draw.
struct DeckSpecimen: View {
    @State private var tab = SpecimenFixtures.DeckTab.activity

    var body: some View {
        SpecimenDeck(session: .preview, tab: $tab)
    }
}
