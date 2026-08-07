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
        }
    }
}

/// Every operational state a roster row can be in, in one column.
private struct SessionRowsSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(SpecimenFixtures.roster) { session in
                SpecimenSessionRow(session: session)
            }
        }
        .padding(ArgoSpacing.section)
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
        SpecimenDeck(session: SpecimenFixtures.roster[0], tab: $tab)
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
