import SwiftUI

/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but Xcode is the only thing that can draw one, and a
/// screenshot is the only evidence a visual claim can be checked against. This catalog addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — which for most of them is not possible at all, since the app
/// launched against an ordinary checkout shows no Sessions.
///
/// Add a case here and it is renderable; `scripts/specimens.sh` reads the list out of this file
/// rather than repeating it.
public enum Specimen: String, CaseIterable, Sendable {
    case foundations
    case contract
    case sessionRows
    case roster
    case toolbarScope
    case emptyToolbarScope
    case projectDrawer
    case unreachableProjectDrawer
    case emptyProjectDrawer
    case openProjectDrawer
    case deck
    case sessionsDeck
    case feed
    case feedCalls
    case feedProse
    case feedEvidence
    case feedRunEvidence
}

/// One catalog entry filling the window. No per-case frame: a state is judged at the width the app
/// actually gives it.
public struct SpecimenScreen: View {
    private let specimen: Specimen

    public init(specimen: Specimen) {
        self.specimen = specimen
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .argoAppearance()
    }

    @ViewBuilder private var content: some View {
        switch specimen {
        case .foundations:
            FoundationSpecimen()
        case .contract:
            ContractSpecimen()
        case .sessionRows:
            SessionRowsSpecimen()
        case .roster:
            RosterSpecimen()
        case .toolbarScope:
            ToolbarSpecimen(presentation: .preview)
        case .emptyToolbarScope:
            ToolbarSpecimen(presentation: .unregisteredPreview)
        case .projectDrawer:
            DrawerSpecimen(presentation: .preview)
        case .unreachableProjectDrawer:
            DrawerSpecimen(presentation: .unreachablePreview)
        case .emptyProjectDrawer:
            // A machine that has registered nothing: Add Project… is the only thing on screen,
            // and it has to be findable without a row beside it to point at.
            DrawerSpecimen(presentation: .unregisteredPreview)
        case .openProjectDrawer:
            OpenDrawerSpecimen()
        case .deck:
            DeckSpecimen()
        case .sessionsDeck:
            // The shell, not `SessionsDeck` — the assembled container is the plane plus its
            // zones, and "one opaque plane" is a claim about the plane.
            InstrumentDeckShell(room: .sessions)
        case .feed:
            // The deck at rest with a Session read into it, drawn through the same projection the
            // shell uses. A specimen holding rows of its own would be evidence about a feed
            // nobody is shown.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewRows,
            )
        case .feedCalls:
            // The work itself, between the prose taken out: every kind the feed can name, the two
            // same-named files that make a qualifier appear, and the failure that earns a second
            // line. Its own case because in the full feed they are four rows in a screenful.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewCallRows,
            )
        case .feedProse:
            // What the agent SAID, with the work taken out: the heading, the list and the fenced
            // block of a real answer. The markdown is drawn as blocks, and whether an outline reads
            // as an outline is the judgement no test can make.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewProseRows,
            )
        case .feedEvidence:
            // The panel open on the failed command. The one state a screenshot has to carry: the
            // feed narrowed to its measure, the rail spent, and what went wrong readable in full
            // beside the row that says only that it did.
            // The call rows rather than the whole feed: opening a row narrows the column it is in,
            // and against the full transcript the failure this is a render OF sits below the fold.
            // A screenshot of a panel whose row is off screen shows half the state.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewCallRows,
                open: FeedProjection.previewFailedCallID,
            )
        case .feedRunEvidence:
            // The collapsed run, open. One row said `Edited FeedCallLine.swift ×3`, and the whole
            // claim of the collapse is that the three moments are still three in the panel — which
            // is a thing to look at rather than to assert.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewCallRows,
                open: FeedProjection.previewRunCallID,
            )
        }
    }
}

/// Every operational state a roster row can be in, in one column — the SHIPPING row, over the
/// sidebar list it ships inside, projected from the same presentation the shell is handed. A
/// specimen drawing a second row is evidence about a row nobody sees.
private struct SessionRowsSpecimen: View {
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
private struct RosterSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: .preview, actions: .inert)
            .environment(navigation)
    }
}

/// The window chrome alone, against an empty plane. One merged capsule at the leading edge and one
/// pinned to the trailing edge is a claim about the toolbar, which the shell specimens bury under
/// everything else in the frame.
private struct ToolbarSpecimen: View {
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
private struct OpenDrawerSpecimen: View {
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
private struct DrawerSpecimen: View {
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

/// The deck specimen, holding the tab selection it needs to draw.
private struct DeckSpecimen: View {
    @State private var tab = SpecimenFixtures.DeckTab.activity

    var body: some View {
        SpecimenDeck(session: .preview, tab: $tab)
    }
}

#Preview("Specimen — the deck") {
    SpecimenScreen(specimen: .deck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the Sessions deck container") {
    SpecimenScreen(specimen: .sessionsDeck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the feed at rest") {
    SpecimenScreen(specimen: .feed)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the work, as sentence-shaped lines") {
    SpecimenScreen(specimen: .feedCalls)
        .frame(width: 1000, height: 620)
}
