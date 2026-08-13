import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The last leg of the join #711 builds: a Subagent's file on disk, read by the Hub, restated by
/// the
/// projection, and keyed the way the rail scopes.
@Suite("Subagent projection")
@MainActor
struct SubagentProjectionTests {
    @Test
    func `a Session's Subagent reading crosses the projection`() async throws {
        let fixture = try SubagentFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        let hub = Hub(projectURL: fixture.rootURL)

        await hub.startObserving(fixture.observation)

        let session = try #require(await settled(hub) { !$0.subagentEvents.isEmpty })
        #expect(session.subagentEvents["a1"]?.contains(.message(markdown: fixture.said)) == true)
        await hub.disconnect()
    }

    /// The rail reads the map by the CLI's id, so a reading that arrived under any other key is one
    /// no chip can open.
    @Test
    func `the reading is keyed by the id the delegating call names`() async throws {
        let fixture = try SubagentFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        let hub = Hub(projectURL: fixture.rootURL)
        await hub.startObserving(fixture.observation)
        let session = try #require(await settled(hub) { !$0.subagentEvents.isEmpty })

        let readings = FeedAgentReadings(events: session.subagentEvents)

        #expect(readings.rows(of: agent(named: "a1")) != nil)
        // A running chip: the id arrives with the delegating call's result, so there is nothing yet
        // to key a reading by.
        #expect(readings.rows(of: agent(named: nil)) == nil)
        // A delegation Argo has the id for and no file for — the host had not written one yet, or
        // never will. No reading either way, which is what keeps the chip quiet rather than making
        // it a control that empties the feed.
        #expect(readings.rows(of: agent(named: "never-written")) == nil)
    }

    private func agent(named subagentID: String?) -> FeedAgent {
        FeedAgent(id: 0, label: "Review", isRunning: false, spend: nil, subagentID: subagentID)
    }

    /// The projected row once the Hub has read what the test wrote, or nothing — the tails run off
    /// this actor's own turns, so there is nothing to await but the answer they produce.
    private func settled(
        _ hub: Hub,
        until applied: (CockpitPresentation.Session) -> Bool,
    ) async
        -> CockpitPresentation.Session? {
        for _ in 0 ..< 500 {
            let projected = CockpitPresentation(projects: [], activeProjectID: nil, hub: hub)
            if let session = projected.sessions.first, applied(session) {
                return session
            }
            try? await Task.sleep(for: .milliseconds(1))
        }
        return nil
    }
}

/// A Session's record with one Subagent beside it, laid down the way Claude Code lays one down.
///
/// On disk rather than handed over as events, because what this suite is testing is the leg that
/// reads files: the Hub finds a Subagent from its parent's own URL.
private struct SubagentFixture {
    let rootURL: URL
    let parentURL: URL
    /// What the Subagent's one record says, which is what the projection is asserted to carry.
    let said = "Two findings, both in the gate."

    init() throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-projection-\(UUID().uuidString)", directoryHint: .isDirectory)
        self.parentURL = rootURL.appending(path: "session.jsonl")
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        try Data().write(to: parentURL)
    }

    /// The parent's own stream, handed over as one batch — a file the tail has finished reading.
    /// Its URL is the real one, which is what the Subagent walk is pointed at.
    var observation: TranscriptObservation {
        TranscriptObservation(
            id: parentURL.path,
            sourceURL: parentURL,
            events: AsyncStream { continuation in
                continuation.yield([.prompt(text: "Review the diff", atMs: 1)])
                continuation.finish()
            },
        )
    }

    func write(agent agentID: String) throws {
        let directoryURL = parentURL.deletingPathExtension()
            .appending(path: "subagents", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let record = """
        {"type":"assistant","isSidechain":true,"agentId":"\(agentID)","uuid":"own-1",\
        "message":{"role":"assistant","content":[{"type":"text","text":"\(said)"}]}}
        """
        // Terminated, because an unterminated last line is a record still being written — which is
        // what a tail treats it as, and it would never be read.
        try Data("\(record)\n".utf8)
            .write(to: directoryURL.appending(path: "agent-\(agentID).jsonl"))
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }
}
