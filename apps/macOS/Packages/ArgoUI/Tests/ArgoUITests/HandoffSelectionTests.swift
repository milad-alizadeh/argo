import ArgoEngine
@testable import ArgoUI
import Testing

/// Where the roster ends up when a handoff lands, and where it stays when one does not (#513,
/// story 48; #1229).
///
/// The switch was reported never to happen, and the line that performs it — `navigation.session =
/// fresh` — sat in a view. It is in `CockpitSpawn` now, beside the two other starts, which is what
/// lets this suite reach it at all.
@Suite("Handoff selection")
@MainActor
struct HandoffSelectionTests {
    /// What the shell asked for, and what it was told came back. A class because `CockpitActions`
    /// holds closures and a struct captured by one cannot be written back.
    @MainActor private final class HandoffRecorder {
        var asked: [(sessionID: String, issue: Int?)] = []
        var answer: String?

        func actions() -> CockpitActions {
            var actions = CockpitActions(drive: InMemorySessionDriver())
            actions.sessions.handOff = { [self] sessionID, issue in
                asked.append((sessionID, issue))
                return answer
            }
            return actions
        }
    }

    private func spawn(
        _ recorder: HandoffRecorder,
        _ navigation: CockpitNavigationModel,
    )
        -> CockpitSpawn {
        CockpitSpawn(
            presentation: .preview,
            actions: recorder.actions(),
            navigation: navigation,
        )
    }

    /// The whole of the ticket's third point: the work moved, so the reader moves with it.
    @Test
    func `the Session the work went to becomes the selection`() async {
        let recorder = HandoffRecorder()
        recorder.answer = "claim-2"
        let navigation = CockpitNavigationModel()
        navigation.session = "full-session"

        await spawn(recorder, navigation).run(handingOff: "full-session", issue: 1229)

        #expect(recorder.asked.map(\.sessionID) == ["full-session"])
        #expect(recorder.asked.map(\.issue) == [1229])
        #expect(navigation.session == "claim-2")
    }

    /// A handoff that did not land leaves the reader on the Session that failed it — which is the
    /// one carrying the row that says so.
    @Test
    func `a handoff that did not happen leaves the selection where it was`() async {
        let recorder = HandoffRecorder()
        let navigation = CockpitNavigationModel()
        navigation.session = "full-session"

        await spawn(recorder, navigation).run(handingOff: "full-session", issue: nil)

        #expect(navigation.session == "full-session")
    }
}
