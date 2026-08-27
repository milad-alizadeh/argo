@testable import ArgoUI
import Testing

/// What the toolbar's Project half says. Every claim here is one the vessel makes in WORDS — the
/// mark is the second reading of unreachability, never the first — and nothing renders a view on
/// CI, so a claim left on the `View` is a claim nothing can check.
@Suite("Project vessel reading")
struct ProjectVesselReadingTests {
    @Test
    func `a reachable Project names itself and the folder it is registered at`() {
        let reading = ProjectVesselReading(project: Self.argo)

        #expect(reading.name == "argo")
        #expect(reading.mark == ArgoSymbol.project)
        #expect(reading.help == "Project — argo · /Users/milad/Developer/argo")
        #expect(reading.announcement == "Project, argo")
    }

    /// State is spoken, never left to the mark: the same sentence the drawer's row carries.
    @Test
    func `an unreachable Project states folder not found in words, twice over`() {
        let reading = ProjectVesselReading(project: Self.moved)

        #expect(reading.help == "Project — penumbra · folder not found")
        #expect(reading.announcement == "Project, penumbra, folder not found")
    }

    /// The words are the drawer's, not a second copy of them — one sentence, one owner.
    @Test
    func `the unreachable sentence is the drawer projection's own`() {
        let reading = ProjectVesselReading(project: Self.moved)

        #expect(reading.help.hasSuffix(ProjectDrawerProjection.unreachable))
        #expect(reading.announcement.hasSuffix(ProjectDrawerProjection.unreachable))
    }

    @Test
    func `the mark degrades down for a folder that is not where it was registered`() {
        #expect(ProjectVesselReading(project: Self.moved).mark == ArgoSymbol.unreachableProject)
    }

    @Test
    func `a machine that has registered nothing says so, and says what to do`() {
        let reading = ProjectVesselReading(project: nil)

        #expect(reading.name == "No Project")
        #expect(reading.mark == ArgoSymbol.project)
        #expect(reading.help == "No Project registered — add one to scope this window")
        #expect(reading.announcement == "Project, none registered")
    }

    /// Two sentences, deliberately: this one is about what the window is SCOPED to, the Session
    /// offer's about why a spawn cannot start. Both asserted, so neither drifts into the other's
    /// job unnoticed.
    @Test
    func `the vessel's refusal is not the New Session offer's`() {
        let vessel = ProjectVesselReading(project: nil)
        let offer = NewSessionOffer(presentation: .unregisteredPreview)

        #expect(vessel.help == "No Project registered — add one to scope this window")
        #expect(offer.blocked == "No Project registered — add one to start a Session here")
    }

    @Test
    func `the reading is taken from the presentation's active Project`() {
        #expect(ProjectVesselReading(presentation: .preview).name == "argo")
        #expect(ProjectVesselReading(presentation: .unreachablePreview).name == "penumbra")
        #expect(ProjectVesselReading(presentation: .unregisteredPreview).name == "No Project")
    }

    private static let argo = CockpitPresentation.Project(
        id: "argo",
        name: "argo",
        location: "/Users/milad/Developer/argo",
    )

    private static let moved = CockpitPresentation.Project(
        id: "moved",
        name: "penumbra",
        location: "/Users/milad/Developer/penumbra",
        isReachable: false,
    )
}
