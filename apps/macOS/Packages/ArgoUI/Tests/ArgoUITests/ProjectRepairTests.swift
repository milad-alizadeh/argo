import ArgoEngine
@testable import ArgoUI
import Testing

/// The two verbs a disabled Project is repaired with. Relocate keeps the Project — the id is what
/// both acts are sent with, and re-pointing the path is what the registry does with it (#851).
@Suite("Repairing a Project")
@MainActor
struct ProjectRepairTests {
    /// Which Project each act was asked about. A class because `CockpitActions` holds closures and
    /// a struct captured by one cannot be written back.
    @MainActor private final class Recorder {
        var located: [String] = []
        var removed: [String] = []

        func repair(_ projectID: String) -> ProjectRepair {
            var actions = CockpitActions(drive: InMemorySessionDriver())
            actions.projects.locate = { [self] id in located.append(id) }
            actions.projects.remove = { [self] id in removed.append(id) }
            return ProjectRepair(projectID: projectID, actions: actions)
        }
    }

    @Test
    func `relocating asks where the Project's folder went, under the id it already had`() {
        let recorder = Recorder()

        recorder.repair("moved").locate()

        #expect(recorder.located == ["moved"])
        #expect(recorder.removed.isEmpty)
    }

    @Test
    func `removing forgets the Project the state names`() {
        let recorder = Recorder()

        recorder.repair("moved").forget()

        #expect(recorder.removed == ["moved"])
        #expect(recorder.located.isEmpty)
    }

    /// One repair, one vocabulary: the disabled window and the Manage submenu offer the SAME two
    /// words, and neither promises to touch the folder on disk.
    @Test
    func `the verbs are spelled once for every surface that offers them`() {
        #expect(ProjectRepair.relocate == "Relocate…")
        #expect(ProjectRepair.remove == "Remove from Argo")
        #expect(
            ProjectRepair.removeHelp
                == "Removes Argo's registration only. The folder on disk is not touched.",
        )
    }

    /// The state word belongs to the registry of status words; the verbs must not borrow it or
    /// invent one of their own.
    @Test
    func `no verb spends a status word`() {
        #expect(!ProjectRepair.all.contains { $0.contains(ProjectMenuProjection.unreachable) })
    }
}
