@testable import ArgoUI
import Testing

/// What a folder that is not at the recorded path does to the window (failure spec §6): the whole
/// Project is disabled, it says so in the registered word, and the two repairs are offered on it.
@Suite("A missing folder disables the Project")
struct ProjectDisabledTests {
    @Test
    func `a Project on a folder that is there leaves the window lit`() {
        #expect(ProjectDisabledReading(presentation: .preview) == nil)
    }

    @Test
    func `a folder that is not where it was registered disables the whole Project`() {
        let reading = ProjectDisabledReading(presentation: .unreachablePreview)

        #expect(reading?.name == "penumbra")
        #expect(reading?.projectID == "moved")
    }

    /// The registry's own word, not a second wording of it: one repair may not carry two
    /// vocabularies.
    @Test
    func `the disabled Project states folder not found`() {
        let reading = ProjectDisabledReading(presentation: .unreachablePreview)

        #expect(reading?.state == ProjectMenuProjection.unreachable)
        #expect(reading?.announcement == "Project, penumbra, folder not found")
    }

    /// The path is what the reader has to recognise to know which folder moved.
    @Test
    func `the disabled Project names the folder it was registered at`() {
        let reading = ProjectDisabledReading(presentation: .unreachablePreview)

        #expect(reading?.detail.contains("/Users/milad/Developer/penumbra") == true)
    }

    /// `.preview` holds an unreachable Project that is NOT the active one, which is a menu row's
    /// state and not this window's.
    @Test
    func `another Project's missing folder does not disable this window`() {
        #expect(ProjectDisabledReading(project: Self.moved) != nil)
        #expect(ProjectDisabledReading(presentation: .preview) == nil)
    }

    /// Neither verb has anything to act on without a record, so the state that offers them is not
    /// the honest one to draw.
    @Test
    func `a folder nobody registered is not a disabled Project`() {
        #expect(ProjectDisabledReading(project: Self.unregistered) == nil)
    }

    @Test
    func `a machine that has registered nothing is not a disabled Project`() {
        #expect(ProjectDisabledReading(presentation: .unregisteredPreview) == nil)
    }

    private static let moved = CockpitPresentation.Project(
        id: "moved",
        name: "penumbra",
        location: "/Users/milad/Developer/penumbra",
        isReachable: false,
    )

    private static let unregistered = CockpitPresentation.Project(
        id: "/Users/milad/Developer/penumbra",
        name: "penumbra",
        location: "/Users/milad/Developer/penumbra",
        isReachable: false,
        isRegistered: false,
    )
}
