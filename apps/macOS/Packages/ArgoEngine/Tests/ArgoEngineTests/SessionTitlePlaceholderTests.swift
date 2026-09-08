@testable import ArgoEngine
import Foundation
import Testing

/// The one name that is a placeholder however it arrived: the uuid a row's transcript is named
/// after (#1695).
///
/// Argo's own mirror typed that filename at the prompt, and the CLI wrote it back as a
/// `custom-title` — the top of the ladder, which nothing outranks. So the row was pinned to its own
/// uuid on the cockpit and on Claude's mobile, desktop and web apps, and the summariser's title
/// three records later was refused. These are the claims that let it be taken back.
///
/// Every Hub here reads a transcript at a real PATH, because that is how the engine keys one
/// (`Engine.observation(at:)`): the row's id is the path and its name is the bare uuid. Through
/// `hubTestObservation(id:)` the id and the filename are one string — a shape production never has,
/// and it would hold a fix that could not fire (#731).
@Suite("Session title placeholders")
@MainActor
struct SessionTitlePlaceholderTests {
    @Test
    func `a title that is the transcript's own uuid is taken back by the summariser's`() async {
        let hub = await hubReading([
            .title(Self.uuid, .custom),
            .title("Composer harness selection", .summarised),
        ])

        #expect(hub.sessions[0].title == "Composer harness selection")
    }

    /// `observe` yields to any name at `.prompt` or above, and a name that is the transcript's own
    /// uuid is below it — so a row pinned to its uuid before it was ever prompted still earns one.
    @Test
    func `the first prompt takes back a title that is the transcript's own uuid`() async {
        let hub = await hubReading([
            .title(Self.uuid, .custom),
            .prompt(text: "Fix the roster titles", images: [], atMs: nil),
        ])

        #expect(hub.sessions[0].title == "Fix the roster titles")
    }

    /// And nothing retypes the uuid while the row waits for either of them.
    ///
    /// This is the repeat the mirror's same-pass check cannot see: a `custom-title` restating the
    /// words already on the row leaves them still, so both halves of that join agree and only the
    /// rung moved.
    @Test
    func `a title that is the transcript's own uuid names no work to mirror`() async {
        let hub = await hubReading([.title(Self.uuid, .custom)])

        #expect(hub.sessions[0].nameStanding.namesTheWork == false)
        #expect(hub.sessions[0].nameStanding.cliTitle == nil)
    }

    /// The transcript the reported row was read from, named after its own chain uuid.
    private static let uuid = "a897fbbf-f7ec-417b-900b-322a20db5f4a"

    private func hubReading(_ events: [TranscriptEvent]) async -> Hub {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let url = URL(fileURLWithPath: "/tmp/argo/\(Self.uuid).jsonl")
        await hubObserveToEnd(hub, hubTestObservation(at: url, events: events))
        return hub
    }
}
