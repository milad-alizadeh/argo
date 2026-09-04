import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The last leg of the join #711 builds: a Subagent's file on disk, read by the Hub, and reaching
/// the rail through the reading it asks for — not through the projection, which carries no child's
/// events since #858.
@Suite("Subagent projection")
@MainActor
struct SubagentProjectionTests {
    @Test
    func `a Session's Subagent reading crosses to the shell`() async throws {
        let fixture = try SubagentFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        let hub = Hub(projectURL: fixture.rootURL)
        let readings = Self.readings(of: hub)

        await hub.startObserving(fixture.observation)

        #expect(await settled(readings, until: { $0.rows(of: agent(named: "a1")) != nil }))
        #expect(hub.subagentReading(of: "a1")?
            .contains(.message(markdown: fixture.said)) == true)
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
        let readings = Self.readings(of: hub)
        await hub.startObserving(fixture.observation)
        #expect(await settled(readings, until: { $0.rows(of: agent(named: "a1")) != nil }))

        #expect(readings.rows(of: agent(named: "a1")) != nil)
        // A running chip: the id arrives with the delegating call's result, so there is nothing yet
        // to key a reading by.
        #expect(readings.rows(of: agent(named: nil)) == nil)
        // A delegation Argo has the id for and no file for — the host had not written one yet, or
        // never will. No reading either way, which is what keeps the chip quiet rather than making
        // it a control that empties the feed.
        #expect(readings.rows(of: agent(named: "never-written")) == nil)
    }

    /// The guarantee `SessionsRoomReading` states for the Session's own feed, for the half that
    /// left it (#858): a reader is asked on every pass, so a Subagent's file that grew while the
    /// reader was looking at it reads as it stands NOW. It was a value copied into the projection
    /// before, and the thing that made that safe was the projection being rebuilt per pass — the
    /// reader has to be at least as fresh, and nothing about it may be kept.
    @Test
    func `a reader asked again sees what the file has said since`() async throws {
        let fixture = try SubagentFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        let hub = Hub(projectURL: fixture.rootURL)
        let readings = Self.readings(of: hub)
        await hub.startObserving(fixture.observation)
        #expect(await settled(readings, until: { $0.rows(of: agent(named: "a1")) != nil }))
        let opening = try #require(readings.rows(of: agent(named: "a1"))).count

        try fixture.append(agent: "a1")

        #expect(await settled(readings, until: {
            ($0.rows(of: agent(named: "a1"))?.count ?? 0) > opening
        }))
        await hub.disconnect()
    }

    private func agent(named subagentID: String?) -> FeedAgent {
        FeedAgent(id: 0, label: "Review", activity: .finished, spend: nil, subagentID: subagentID)
    }

    /// The reading the shell is handed — the same closure `ArgoApp` builds, so what this suite
    /// asserts is the path that ships.
    private static func readings(of hub: Hub) -> FeedAgentReader {
        FeedAgentReader.reading(hub)
    }

    /// Whether the Hub has read what the test wrote — the tails run off this actor's own turns, so
    /// there is nothing to await but the answer they produce.
    private func settled(
        _ readings: FeedAgentReader,
        until read: (FeedAgentReader) -> Bool,
    ) async
        -> Bool {
        for _ in 0 ..< 500 {
            if read(readings) {
                return true
            }
            try? await Task.sleep(for: .milliseconds(1))
        }
        return false
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
                continuation.yield([.prompt(text: "Review the diff", images: [], atMs: 1)])
                continuation.finish()
            },
        )
    }

    func write(agent agentID: String) throws {
        let directoryURL = parentURL.deletingPathExtension()
            .appending(path: "subagents", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        // Terminated, because an unterminated last line is a record still being written — which is
        // what a tail treats it as, and it would never be read.
        try Data("\(Self.record(agentID, saying: said))\n".utf8)
            .write(to: directoryURL.appending(path: "agent-\(agentID).jsonl"))
    }

    /// A second record on the same Subagent's file, the way a live one grows.
    func append(agent agentID: String) throws {
        let url = parentURL.deletingPathExtension()
            .appending(path: "subagents", directoryHint: .isDirectory)
            .appending(path: "agent-\(agentID).jsonl")
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: Data("\(Self.record(agentID, saying: "And again."))\n".utf8))
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    private static func record(_ agentID: String, saying words: String) -> String {
        """
        {"type":"assistant","isSidechain":true,"agentId":"\(agentID)","uuid":"\(UUID()
            .uuidString)",\
        "message":{"role":"assistant","content":[{"type":"text","text":"\(words)"}]}}
        """
    }
}
