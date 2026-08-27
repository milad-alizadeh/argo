import ArgoEngine
@testable import ArgoUI
import Testing

/// A line the reader could not parse still HAPPENED. Something wrote it, and a feed that drops it
/// on the floor cannot tell "nothing happened" from "I could not read what happened" — which is
/// the one distinction the whole surface exists to keep.
@Suite("Feed unreadable lines")
struct FeedUnreadableTests {
    @Test
    func `a line the reader could not parse gets a row of its own`() throws {
        let rows = FeedProjection.rows(from: [.unreadableLine(raw: "{\"role\":")])
        let unreadable = try #require(FeedFixture.unreadable(in: rows).first)

        #expect(rows.count == 1)
        #expect(unreadable.count == 1)
    }

    /// The raw text rides along because the engine kept it. A row saying only that something was
    /// unreadable is a claim the reader has no way to check.
    @Test
    func `the row carries the raw text the engine could not read`() throws {
        let raw = "{\"type\":\"assistant\",\"message\":"
        let rows = FeedProjection.rows(from: [.unreadableLine(raw: raw)])
        let unreadable = try #require(FeedFixture.unreadable(in: rows).first)

        #expect(unreadable.lines == [raw])
    }

    /// A truncated write can leave a tail of them, and one row per line would turn a corrupt file
    /// into a screenful of identical rows.
    @Test
    func `a run of unreadable lines is one row with a count`() throws {
        let rows = FeedProjection.rows(from: [
            .unreadableLine(raw: "{"),
            .unreadableLine(raw: "["),
            .unreadableLine(raw: "\"\""),
        ])
        let unreadable = try #require(FeedFixture.unreadable(in: rows).first)

        #expect(rows.count == 1)
        #expect(unreadable.count == 3)
        #expect(unreadable.lines == ["{", "[", "\"\""])
    }

    /// The run is consecutive, exactly as every other run in this feed is.
    @Test
    func `a readable record between two unreadable lines keeps them apart`() {
        let rows = FeedProjection.rows(from: [
            .unreadableLine(raw: "{"),
            .message(markdown: "Carrying on."),
            .unreadableLine(raw: "["),
        ])

        #expect(FeedFixture.unreadable(in: rows).map(\.count) == [1, 1])
    }

    /// With something unread in the middle, a count of what the run looked at can no longer be a
    /// claim about the whole stretch.
    @Test
    func `an unreadable line breaks a run of looking`() {
        let rows = FeedProjection.rows(from:
            looking(at: ["a.swift", "b.swift"])
                + [.unreadableLine(raw: "{")]
                + looking(at: ["c.swift", "d.swift"]))

        #expect(FeedFixture.surveys(in: rows).count == 2)
    }

    /// An unreadable line produced no evidence, so a disclosure marker on it would open an empty
    /// panel.
    @Test
    func `an unreadable line is not a piece of work the feed can open`() throws {
        let rows = FeedProjection.rows(from: [.unreadableLine(raw: "{")])
        let row = try #require(rows.first)

        #expect(!row.kind.isCall)
    }

    /// A row spoken as "unreadable" alone reads as one incident, so the count has to be spoken too.
    @Test
    func `the run speaks how many lines it stands for`() throws {
        let rows = FeedProjection.rows(from: [
            .unreadableLine(raw: "{"),
            .unreadableLine(raw: "["),
        ])
        let unreadable = try #require(FeedFixture.unreadable(in: rows).first)

        #expect(unreadable.label.contains("2"))
    }

    private func looking(at paths: [String]) -> [TranscriptEvent] {
        paths.enumerated().flatMap { position, path -> [TranscriptEvent] in
            let id = "read-\(path)-\(position)"
            return [
                .toolCall(FeedFixture.call(id, tool: "Read", kind: .read, naming: path)),
                .toolCallOutcome(TranscriptFixtures.printed(id, "let token = 1")),
            ]
        }
    }
}
