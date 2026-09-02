@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a folder that is not at the recorded path does to the window (failure spec §6): the whole
/// Project is disabled, and it says so in the registered word.
@Suite("A missing folder disables the Project")
struct ProjectDisabledTests {
    /// Every Project the window is NOT disabled by, and why each is left alone. One table rather
    /// than a case each: the claim is identical, and it is the reasons that differ.
    static let lit: [(why: String, presentation: CockpitPresentation)] = [
        ("its folder is where it was registered", .preview),
        ("nothing is registered on this machine", .unregisteredPreview),
    ]

    @Test(arguments: lit)
    func `a Project the window can act in leaves it lit`(
        _ project: (why: String, presentation: CockpitPresentation),
    ) {
        #expect(ProjectDisabledReading(presentation: project.presentation) == nil)
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
    }

    /// The path is what the reader has to recognise to know which folder moved.
    @Test
    func `the disabled Project names the folder it was registered at`() {
        let reading = ProjectDisabledReading(presentation: .unreachablePreview)

        #expect(reading?.detail.contains("/Users/milad/Developer/penumbra") == true)
    }

    /// `.preview` holds a Project whose folder is gone that is NOT the active one — a menu row's
    /// state, and no reason to darken a window pointed somewhere else. The same record is asked
    /// about twice on purpose: what makes the second answer mean anything is that the first one is
    /// a disabling Project.
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
