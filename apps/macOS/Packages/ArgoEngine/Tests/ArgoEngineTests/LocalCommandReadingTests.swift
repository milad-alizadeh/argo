@testable import ArgoEngine
import Testing

/// The record's own account of a command the CLI answered ITSELF (#1234) — see `promptEvents`.
@Suite("Local command reading")
struct LocalCommandReadingTests {
    @Test
    func `the stdout ends the Turn its command opened`() async throws {
        let events = try await Fixture.events("localCommandTurn")

        // After the call and its outcome, never before: the command printed, and then it was over.
        let ending = events.suffix(3)
        #expect(ending.last == .turnEnded(.endTurn))
        #expect(ending.contains { event in
            guard case let .toolCall(call) = event else { return false }
            return call.name == "local command"
        })
    }

    /// The fault the ticket opens on: the local command is the last thing in the file, and a reader
    /// that closed nothing leaves the Turn open behind it.
    @Test
    func `a Session whose last exchange was a local command has no Turn open`() async throws {
        var session = HubSession(observation: hubTestObservation(id: "localCommand", events: []))
        for event in try await Fixture.events("localCommandTurn") {
            session.apply(event)
        }

        #expect(!session.signals.turnOpen)
        #expect(session.signals.lastStop == .endTurn)
    }

    /// A command with a transcript after it closes its own Turn where it printed, rather than
    /// leaning on the next agent Turn's boundary to close it late.
    ///
    /// Read by POSITION and not off the rolled-up signals: `harnessNoise` ends in an agent's own
    /// `end_turn`, so a Session folded from the whole file reads shut either way — which is a claim
    /// that holds with the reading this suite is about and without it.
    @Test
    func `a command mid-transcript closes its Turn where it printed`() async throws {
        let events = try await Fixture.events("harnessNoise")
        let printed = try #require(events.firstIndex { event in
            guard case let .toolCallOutcome(outcome) = event else { return false }
            return outcome.id == "u-stdout"
        })
        // `/effort` prints, and the next thing anybody asks for is `/implement`.
        let asked = try #require(events.firstIndex { event in
            guard case let .prompt(text, _, _) = event else { return false }
            return text.hasPrefix("/implement")
        })

        #expect(events[printed ..< asked].contains(.turnEnded(.endTurn)))
    }
}
