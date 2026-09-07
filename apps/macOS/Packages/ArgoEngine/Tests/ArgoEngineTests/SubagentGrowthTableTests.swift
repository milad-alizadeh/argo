@testable import ArgoEngine
import Foundation
import Testing

/// The growth table the roster reads (#1572) — the whole-set shape of the per-id lookup
/// `SubagentReadingsTests` covers, held to the same one-file rule.
@Suite("Subagent growth table")
@MainActor
struct SubagentGrowthTableTests {
    private let agentID = "agent-1"
    private static let file = "/tmp/argo-subagents/agent-1.jsonl"
    private static let moved = "/tmp/argo-moved/agent-1.jsonl"
    private static let said = TranscriptEvent.message(markdown: "the child said")
    private static let saidAgain = TranscriptEvent.message(markdown: "the child said again")

    /// The table the roster asks for (#1572). Every Agent the per-id call would answer, in one
    /// answer — the roster learns which ids to ask about by walking the record the answer is wanted
    /// inside, so it cannot ask one at a time.
    @Test
    func `the growth table holds every dated agent`() {
        let readings = SubagentReadings(clock: { 1000 })
        readings.beginReading(of: agentID, from: Self.file)
        readings.apply([Self.said], from: Self.file)
        readings.apply([Self.saidAgain], from: Self.file)
        // A second Agent still on its backfill: watched, and not yet watched to GROW.
        readings.beginReading(of: "agent-2", from: Self.moved)
        readings.apply([Self.said], from: Self.moved)

        #expect(readings.growth() == [agentID: 1000])
    }

    /// Under the same one-file rule the two lookups beside it follow: an Agent whose id names two
    /// live files is one Argo can say nothing about, and a growing half would otherwise date it.
    @Test
    func `an agent under two files is left out of the growth table`() {
        let readings = SubagentReadings(clock: { 1000 })
        for file in [Self.file, Self.moved] {
            readings.beginReading(of: agentID, from: file)
            readings.apply([Self.said], from: file)
            readings.apply([Self.saidAgain], from: file)
        }

        #expect(readings.lastGrewAtMs(of: agentID) == nil)
        #expect(readings.growth().isEmpty)
    }
}
