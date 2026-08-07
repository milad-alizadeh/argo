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
    case projectStrip
    case emptyProjectStrip
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
        case .projectStrip:
            ProjectStripSpecimen(projects: CockpitPresentation.previewProjects)
        case .emptyProjectStrip:
            // A machine that has registered nothing: the `+` is the only thing on screen, and it
            // has to be findable without a Project beside it to point at.
            ProjectStripSpecimen(projects: [])
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

/// The strip against the sidebar material it actually sits on, holding its own selection so the
/// switch can be driven in the rendered state rather than only described.
private struct ProjectStripSpecimen: View {
    let projects: [CockpitPresentation.Project]

    @State private var activeProjectID: CockpitPresentation.Project.ID?

    init(projects: [CockpitPresentation.Project]) {
        self.projects = projects
        _activeProjectID = State(initialValue: projects.first?.id)
    }

    var body: some View {
        ProjectStrip(
            projects: projects,
            activeProjectID: activeProjectID,
            actions: CockpitActions(
                refreshCheckout: {},
                retryConnection: {},
                selectProject: { activeProjectID = $0 },
                addProject: {},
                locateProject: { _ in },
            ),
        )
        .frame(maxHeight: .infinity)
        .background(.bar)
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
