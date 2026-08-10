@testable import ArgoUI
import Testing

/// What the toolbar's one verb promises: it asks for a Session where one can be started, it asks
/// for nothing where one cannot, and the roster ends up on what it started.
@Suite("New Session")
@MainActor
struct NewSessionSpawnTests {
    /// How many spawns were asked for, and what the shell was told each answered with. A class
    /// because `CockpitActions` holds closures and a struct captured by one cannot be written back.
    private final class SpawnRecorder {
        var requests = 0
        var answer: String?

        func actions() -> CockpitActions {
            CockpitActions(
                refreshCheckout: {},
                retryConnection: {},
                selectProject: { _ in },
                addProject: {},
                locateProject: { _ in },
                revealProject: { _ in },
                removeProject: { _ in },
                spawnSession: { [self] in
                    requests += 1
                    return answer
                },
                setSessionArchived: { _, _ in },
                setSessionName: { _, _ in },
                handOffSession: { _, _ in nil },
            )
        }
    }

    @Test
    func `a Project on a folder that is there offers the spawn`() {
        #expect(NewSessionOffer(presentation: .preview).isLaunchable)
    }

    @Test
    func `a machine that has registered nothing says so rather than offering`() {
        let offer = NewSessionOffer(presentation: .unregisteredPreview)
        #expect(!offer.isLaunchable)
        #expect(offer.blocked == "No Project registered — add one to start a Session here")
    }

    /// The refusal is the engine's own sentence, naming the folder — not a second account of the
    /// same failure written for the tooltip.
    @Test
    func `a Project whose folder has gone names the folder it cannot run in`() {
        let offer = NewSessionOffer(presentation: .unreachablePreview)
        #expect(offer.blocked == "/Users/milad/Developer/penumbra is not a folder")
    }

    @Test
    func `activating the action asks for a spawn`() async {
        let recorder = SpawnRecorder()
        recorder.answer = "claim-1"
        let navigation = CockpitNavigationModel()
        let spawn = CockpitSpawn(
            presentation: .preview,
            actions: recorder.actions(),
            navigation: navigation,
        )

        await spawn.run()

        #expect(recorder.requests == 1)
    }

    /// A shortcut reaches the action without passing the disabled button, so the refusal has to
    /// hold in the action too.
    @Test
    func `the blocked action asks for nothing`() async {
        let recorder = SpawnRecorder()
        let navigation = CockpitNavigationModel()
        let spawn = CockpitSpawn(
            presentation: .unregisteredPreview,
            actions: recorder.actions(),
            navigation: navigation,
        )

        await spawn.run()

        #expect(recorder.requests == 0)
        #expect(navigation.session == nil)
    }

    @Test
    func `the Session that just started becomes the selection`() async {
        let recorder = SpawnRecorder()
        recorder.answer = "claim-1"
        let navigation = CockpitNavigationModel()
        navigation.session = "shell"
        let spawn = CockpitSpawn(
            presentation: .preview,
            actions: recorder.actions(),
            navigation: navigation,
        )

        await spawn.run()

        #expect(navigation.session == "claim-1")
    }

    /// A spawn that failed reported itself in the app's own alert; the roster must not move off the
    /// Session the reader was on, and above all must not point at a row nobody published.
    @Test
    func `a spawn that did not happen leaves the selection where it was`() async {
        let recorder = SpawnRecorder()
        let navigation = CockpitNavigationModel()
        navigation.session = "shell"
        let spawn = CockpitSpawn(
            presentation: .preview,
            actions: recorder.actions(),
            navigation: navigation,
        )

        await spawn.run()

        #expect(recorder.requests == 1)
        #expect(navigation.session == "shell")
    }
}
