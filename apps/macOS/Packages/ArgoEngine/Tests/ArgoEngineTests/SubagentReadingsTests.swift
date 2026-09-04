@testable import ArgoEngine
import Foundation
import Testing

/// What a Subagent's bytes reach, and what they must leave alone (#858).
///
/// A fan-out's files grow the whole time an agent works, so what a child's batch DISTURBS is the
/// cockpit's idle cost: while these events lived in the join, every one of them republished the
/// roster and invalidated the scene root — the ~1.8 s heartbeat the ticket recorded, with nothing
/// on screen changing. The first two cases watch the roster through the same door the cockpit
/// reads it by and assert whether that read was invalidated, never whether a rule returned true.
@Suite("Subagent readings")
@MainActor
struct SubagentReadingsTests {
    private let agentID = "agent-1"
    private static let file = "/tmp/argo-subagents/agent-1.jsonl"
    private static let moved = "/tmp/argo-moved/agent-1.jsonl"
    private static let said = TranscriptEvent.message(markdown: "the child said")
    private static let saidAgain = TranscriptEvent.message(markdown: "the child said again")

    /// The claim the whole change is for.
    @Test
    func `a Subagent's batch does not invalidate the roster`() async {
        let hub = await readingHub()
        let roster = Tripwire.watching { _ = hub.sessions }

        hub.subagents.beginReading(of: agentID, from: Self.file)
        hub.subagents.apply([Self.said], from: Self.file)

        #expect(!roster.fired)
        #expect(hub.subagentReading(of: agentID) == [Self.said])
    }

    /// The control on the case above: the same wire, watched the same way, fires for the Session's
    /// OWN bytes. Without it that case could pass because nothing was ever observed.
    @Test
    func `a Session's own batch does invalidate the roster`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let (observation, records) = hubLiveObservation(id: "session")
        await hub.startObserving(observation)
        records.yield([.title("Reading")])
        await hubSettle { !hub.sessions.isEmpty }
        let roster = Tripwire.watching { _ = hub.sessions }

        records.yield([.message(markdown: "the agent said")])
        await hubSettle { roster.fired }

        #expect(roster.fired)
        records.finish()
    }

    /// And the reading the rail draws IS invalidated, because that is the one surface a child's
    /// bytes belong to. A narrowing that reached nothing would be a lane that never redraws.
    @Test
    func `a Subagent's batch invalidates the reading that draws it`() async {
        let hub = await readingHub()
        hub.subagents.beginReading(of: agentID, from: Self.file)
        let lane = Tripwire.watching { _ = hub.subagentReading(of: agentID) }

        hub.subagents.apply([Self.said], from: Self.file)

        #expect(lane.fired)
    }

    /// A tail re-reads its file from the first byte, so a transcript that aged out of the working
    /// set and came back used to append its Subagents' rows a second time.
    @Test
    func `a file read again replaces what the last read of it left`() {
        let readings = SubagentReadings()
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)

        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)

        #expect(readings.reading(of: agentID) == [Self.said])
    }

    /// The CLI MOVES a transcript (#770) and leaves its Subagent files at the path it left, so both
    /// halves are tailed and both carry the same ids. Which of them is live is the chain graph's
    /// answer and not this store's, so it answers nothing rather than drawing a frozen prefix as
    /// though it were the reading — the rule `HubRoster` used to enforce by refusing both.
    @Test
    func `an Agent two files are being read for has no reading`() {
        let readings = SubagentReadings()
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)

        readings.beginReading(of: agentID, from: Self.moved)

        #expect(readings.reading(of: agentID) == nil)
    }

    /// And it resolves itself: the sweep drops the path that has gone, and the survivor answers
    /// with the bytes it was accumulating all along rather than waiting for a re-read.
    @Test
    func `the surviving file answers once the other is dropped`() {
        let readings = SubagentReadings()
        readings.beginReading(of: agentID, from: Self.file)
        readings.beginReading(of: agentID, from: Self.moved)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.moved)

        readings.forget(claims: [agentID: Self.file])

        #expect(readings.reading(of: agentID) == [Self.saidAgain])
    }

    /// A read carrying nothing is a Subagent with no reading rather than one with an empty reading
    /// — degrade-down, and what keeps its chip quiet instead of making it a control that empties
    /// the feed.
    @Test
    func `a file that has said nothing yet has no reading`() {
        let readings = SubagentReadings()

        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([], from: Self.file)

        #expect(readings.reading(of: agentID) == nil)
    }

    /// What a transcript dropped from the set takes with it, and only that: a Session's row goes
    /// when its file does, and its children's readings go with the row.
    @Test
    func `forgetting one Agent leaves the others standing`() {
        let readings = SubagentReadings()
        for agent in ["a", "b"] {
            readings.beginReading(of: agent, from: Self.file(of: agent))
            readings.apply([Self.said], from: Self.file(of: agent))
        }

        readings.forget(claims: ["a": Self.file(of: "a")])

        #expect(readings.reading(of: "a") == nil)
        #expect(readings.reading(of: "b") == [Self.said])
    }

    /// The GROWTH clock (#1269), and the whole reason it is not simply "when Argo last read this
    /// file": a tail re-reads from the first byte, so the backfill of a child that finished
    /// yesterday arrives NOW. Stamping that would draw every long-dead delegation live for ten
    /// minutes after the cockpit opened.
    @Test
    func `the backfill of a file is not a write Argo saw`() {
        let readings = SubagentReadings(clock: { 1000 })

        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)

        #expect(readings.reading(of: agentID) == [Self.said])
        #expect(readings.lastGrewAtMs(of: agentID) == nil)
    }

    /// And the claim it is for: a batch AFTER the backfill is Argo watching the child write.
    @Test
    func `a batch after the backfill is dated`() {
        let readings = SubagentReadings(clock: { 1000 })

        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.file)

        #expect(readings.lastGrewAtMs(of: agentID) == 1000)
    }

    /// A re-read starts the file over, backfill and all — the same rule the reading itself follows,
    /// for the same reason.
    @Test
    func `a file read again is backfilled again`() {
        let readings = SubagentReadings(clock: { 1000 })
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.file)

        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)

        #expect(readings.lastGrewAtMs(of: agentID) == nil)
    }

    /// Answered per Agent under the rule the reading is answered by: two files carrying one id
    /// answer nothing, so a growing half cannot date an Agent Argo cannot resolve.
    @Test
    func `an Agent two files are being read for has no growth`() {
        let readings = SubagentReadings(clock: { 1000 })
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.file)

        readings.beginReading(of: agentID, from: Self.moved)

        #expect(readings.lastGrewAtMs(of: agentID) == nil)
    }

    /// What a dropped transcript takes with it takes the date too — a reading that is gone cannot
    /// leave a stamp behind saying its Agent was writing.
    @Test
    func `forgetting a reading forgets when it grew`() {
        let readings = SubagentReadings(clock: { 1000 })
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.file)

        readings.forget(claims: [agentID: Self.file])

        #expect(readings.lastGrewAtMs(of: agentID) == nil)
    }

    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-subagent-readings")

    private static func file(of agent: String) -> String {
        "/tmp/argo-subagents/\(agent).jsonl"
    }

    /// One Session on the roster, read and published — so the wire above watches a roster that is
    /// standing rather than the emptiness a held-back tail gives.
    private func readingHub() async -> Hub {
        let hub = testHub(projectURL: Self.projectURL)
        await hub.startObserving(hubTestObservation(id: "session", events: [.title("Reading")]))
        await hubSettle { !hub.sessions.isEmpty }
        return hub
    }
}
