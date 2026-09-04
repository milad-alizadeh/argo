@testable import ArgoEngine
import Testing

/// The record's own account of a Turn somebody stopped (#1189).
///
/// The CLI writes the marker as a USER entry and writes no `stop_reason` anywhere, so a reader that
/// takes it at face value opens a Turn on the very act that ended one — and the Session it is read
/// from never comes back off `running`. Reading it as the boundary it is, is the whole of this.
@Suite("Interrupt reading")
struct InterruptReadingTests {
    @Test
    func `the marker is a boundary rather than something the reader typed`() async throws {
        let events = try await Fixture.events("interruptedTurn")

        #expect(events.contains(.interrupted(atMs: 1_788_429_607_000)))
        #expect(!events.contains { event in
            guard case let .prompt(text, _, _) = event else { return false }
            return ClaudeInterrupt.isMark(text)
        })
    }

    /// The fault the ticket opens on: `tool_use` ends nothing, the marker is the only record after
    /// it, and a reader that opened a Turn on it leaves the Session `running` for good.
    @Test
    func `a Turn stopped mid tool call is closed by the marker`() async throws {
        var session = HubSession(observation: hubTestObservation(id: "interrupted", events: []))
        for event in try await Fixture.events("interruptedTurn") {
            session.apply(event)
        }

        #expect(!session.signals.turnOpen)
        #expect(session.signals.lastStop == .cancelled)
    }

    /// A live Session reads `idle` off that boundary — alive, and not working. The claim the
    /// composer's Stop control is drawn from.
    @Test
    func `a live Session comes off running once the marker lands`() {
        let stopped = SessionSignals(
            provenance: .managed,
            liveness: .live,
            turnOpen: false,
            lastStop: .cancelled,
            pendingAsk: false,
        )

        #expect(SessionStatus.read(stopped).status == .idle)
    }

    /// The marker wins over the picture path too. A record carrying pixels is a prompt however few
    /// words are in it — an interrupt is the one exception, and it has to be read before the
    /// pictures decide.
    @Test
    func `a marker record carrying a picture is still the boundary`() async {
        let line = """
        {"type":"user","timestamp":"2026-09-03T10:00:07.000Z","uuid":"i-u-9",\
        "message":{"role":"user","content":[\
        {"type":"text","text":"[Request interrupted by user]"},\
        {"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgo="}}\
        ]}}
        """

        let events = await TranscriptReader().read(line: line)

        #expect(events.contains(.interrupted(atMs: 1_788_429_607_000)))
        #expect(!events.contains { event in
            guard case .prompt = event else { return false }
            return true
        })
    }

    /// Both spellings the CLI writes. `for tool use` is what it files when the Turn was stopped
    /// inside a call, which is the commoner half of a real record: 99 of them against 433 plain
    /// across this machine's transcripts on 2026-09-04.
    @Test
    func `both spellings of the marker are recognised`() {
        #expect(ClaudeInterrupt.isMark("[Request interrupted by user]"))
        #expect(ClaudeInterrupt.isMark("[Request interrupted by user for tool use]"))
    }

    /// Matched WHOLE, still: a reader quoting either spelling in a message of their own gets their
    /// message back rather than a boundary drawn through the middle of it.
    @Test
    func `a message quoting either spelling stays a message`() {
        #expect(!ClaudeInterrupt.isMark("Why does [Request interrupted by user] show up twice?"))
        #expect(!ClaudeInterrupt
            .isMark("[Request interrupted by user for tool use] — what does that mean?"))
        #expect(!ClaudeInterrupt.isMark("Carry on."))
    }
}
