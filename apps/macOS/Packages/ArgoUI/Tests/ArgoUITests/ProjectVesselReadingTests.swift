import ArgoDesign
@testable import ArgoUI
import Testing

/// What the toolbar's Project half says. Every claim here is one the vessel makes in WORDS: the
/// mark is the second reading of unreachability, never the first.
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

    @Test
    func `an unreachable Project states folder not found in words, twice over`() {
        let reading = ProjectVesselReading(project: Self.moved)

        #expect(reading.help == "Project — penumbra · folder not found")
        #expect(reading.announcement == "Project, penumbra, folder not found")
    }

    @Test
    func `the unreachable sentence is the drawer projection's own`() {
        let reading = ProjectVesselReading(project: Self.moved)

        #expect(reading.help.hasSuffix(ProjectMenuProjection.unreachable))
        #expect(reading.announcement.hasSuffix(ProjectMenuProjection.unreachable))
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

    @Test
    func `the vessel's refusal is not the New Session offer's`() {
        let vessel = ProjectVesselReading(project: nil)
        let offer = NewSessionOffer(presentation: .unregisteredPreview)

        #expect(vessel.help == "No Project registered — add one to scope this window")
        #expect(offer.blocked == "No Project registered — add one to start a Session here")
    }

    /// The one gesture the vessel carries, whatever state the Project is in.
    @Test
    func `the press is described the same way in every state`() {
        #expect(ProjectVesselReading.hint == "Opens the Project drawer")
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
