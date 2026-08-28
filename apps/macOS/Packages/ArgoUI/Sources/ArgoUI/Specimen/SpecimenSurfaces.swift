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

/// The sidebar with a row SELECTED and a room picked — the one render that shows where #875 put
/// the identity, and the only one that can.
///
/// It has to be an app-target specimen and it has to be this view: the selection capsule is
/// coloured from the `AccentColor` asset, which an `ArgoUI` preview builds without and draws in the
/// OS accent instead (D30). The rooms strip is in the same frame deliberately — the segmented
/// control's selected segment is the second placement of the same hue, and two weights of one
/// colour can only be judged side by side.
struct SelectedRowSpecimen: View {
    @State private var selection = CockpitPresentation.preview.sessions.first?.id
    @State private var room = CockpitRoom.sessions

    var body: some View {
        ShellSidebar(presentation: .preview, selection: $selection, room: $room)
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

    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        Color.clear
            .toolbar {
                ShellToolbar(
                    scope: ScopeVessel(presentation: presentation, actions: .inert),
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

// The Project menu has no specimen of its own since #875. It is a native menu: its items are drawn
// in a window of the system's, which never lands in a screenshot of this one, and there is no
// content left to draw directly — the heading, the rows and the active fill are all AppKit's now.
// `toolbarScope` above is the whole of what a render can see, and `ProjectMenuE2ETests` is what
// opens it.

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
    let header: SessionHeaderProjection.Header

    var body: some View {
        SessionContextGuide(facts: header.facts)
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
