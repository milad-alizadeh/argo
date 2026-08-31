@testable import ArgoEngine
import Foundation
import Testing

/// What the roster publishes while a sweep is still reading (`HubJoinPublishable`).
///
/// It used to publish nothing until every admitted transcript had settled. At three transcripts
/// nobody noticed; at a week's working set one slow file would be the whole launch.
@Suite("Roster publishing while a sweep runs")
struct HubRosterProgressiveTests {
    @Test
    func `a transcript that has been read publishes while another has not`() {
        var join = HubJoin()
        join.add(hubTestObservation(id: "read", events: []))
        join.add(hubTestObservation(id: "unread", events: []))

        join.apply(Self.turn(atMs: 10), to: "read")

        #expect(join.sessions.map(\.id) == ["read"])
    }

    /// The property the all-or-nothing gate was protecting, and the one that has to survive: a row
    /// on screen may go on being missing a neighbour, but it may not be taken away and it may not
    /// change places. A resume file publishing as a Session of its own would be absorbed by the
    /// parent when the parent arrives — one row vanishing and another changing under the cursor.
    @Test
    func `a resume continuation waits for the transcript it continues`() {
        var join = HubJoin()
        let root = recordURL("project", "root")
        let resume = recordURL("project", "resume")
        join.add(hubTestObservation(at: root, events: []))
        join.add(hubTestObservation(at: resume, events: []))

        join.apply([.headLeaf(uuid: "root-tail")] + Self.turn(atMs: 20), to: resume.path)
        #expect(join.sessions.isEmpty)

        join.apply([.recordIdentity(uuid: "root-tail")] + Self.turn(atMs: 10), to: root.path)

        #expect(join.sessions.map(\.id) == [root.path])
    }

    @Test
    func `rows already published keep their order as the rest arrive`() {
        var join = HubJoin()
        for name in ["oldest", "newest", "middle"] {
            join.add(hubTestObservation(id: name, events: []))
        }

        join.apply(Self.turn(atMs: 100), to: "oldest")
        join.apply(Self.turn(atMs: 300), to: "newest")
        let published = join.sessions.map(\.id)
        join.apply(Self.turn(atMs: 200), to: "middle")

        // The same comparator over the same keys, so the two rows that were on screen are still in
        // the order they were in — with the third let in where it belongs.
        #expect(published == ["newest", "oldest"])
        #expect(join.sessions.map(\.id) == ["newest", "middle", "oldest"])
    }

    /// A file that cannot be opened says nothing until its tail gives up (`HubJoin.settle`). The
    /// roster that used to wait on it now publishes without it and lets it in when it lands.
    @Test
    func `a transcript that has said nothing yet holds no other row back`() {
        var join = HubJoin()
        join.add(hubTestObservation(id: "readable", events: []))
        join.add(hubTestObservation(id: "silent", events: []))

        join.apply(Self.turn(atMs: 10), to: "readable")
        #expect(join.sessions.map(\.id) == ["readable"])

        join.settle(transcriptID: "silent")

        // In behind it, never in front: a transcript that can say nothing about when it ran sorts
        // last, so the row already on screen does not move.
        #expect(join.sessions.map(\.id) == ["readable", "silent"])
    }

    /// One Turn, which is the least a transcript has to say to earn a roster row.
    private static func turn(atMs: Int) -> [TranscriptEvent] {
        [.prompt(text: "Work", images: [], atMs: atMs), .turnEnded(.endTurn)]
    }
}
