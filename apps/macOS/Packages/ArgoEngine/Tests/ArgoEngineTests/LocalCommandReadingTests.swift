@testable import ArgoEngine
import Testing

/// The record's own account of a command the CLI answered ITSELF (#1234).
///
/// `/model opus` is typed at the prompt like a Turn and the CLI writes a prompt record for it, but
/// no agent ever answers one: the whole exchange is that record and the stdout beside it. A reader
/// that opens a Turn on the prompt and closes it on nothing leaves the Session `running` for good,
/// which is the same fault `.interrupted` was read for in #1189 and the same fix: the record that
/// ENDS the exchange is read as the boundary it is.
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

    /// A live Session reads `idle` off that boundary — alive, and not working. Which is what takes
    /// the spinner down and unlocks the composer the ticket found locked.
    @Test
    func `a live Session comes off running once the command has printed`() {
        let printed = SessionSignals(
            provenance: .managed,
            liveness: .live,
            turnOpen: false,
            lastStop: .endTurn,
            pendingAsk: false,
        )

        #expect(SessionStatus.read(printed).status == .idle)
    }

    /// A command whose stdout is only the FIRST half of the exchange still ends its own Turn, and
    /// the prompt that follows opens the next one. The two must not be read as one long Turn.
    @Test
    func `a command mid-transcript closes only its own Turn`() async throws {
        var session = HubSession(observation: hubTestObservation(id: "noise", events: []))
        for event in try await Fixture.events("harnessNoise") {
            session.apply(event)
        }

        // `harnessNoise` runs `/effort`, then asks for real work and gets an answer.
        #expect(!session.signals.turnOpen)
        #expect(session.signals.lastStop == .endTurn)
    }
}
