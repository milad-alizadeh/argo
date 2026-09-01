import ArgoEngine
@testable import ArgoUI
import Testing

/// A picture is the one result that gets worse the smaller it is drawn, so a run of them becomes a
/// row of thumbnails rather than a run of filenames. Which runs FOLD that way is what this suite
/// claims: where a run starts, where it breaks, and the calls that stay a line instead.
///
/// What one shot inside the fold says about itself is `FeedShotReadingTests`.
@Suite("Feed galleries")
struct FeedGalleryTests {
    @Test
    func `consecutive pictures render as one gallery`() throws {
        let rows = FeedProjection.rows(from: FeedFixture.looked(at: ["a.png", "b.png", "c.png"]))
        let gallery = try #require(FeedFixture.galleries(in: rows).first)

        #expect(rows.count == 1)
        #expect(gallery.shots.map(\.name) == ["a.png", "b.png", "c.png"])
    }

    /// A gallery of one is still a gallery, where the survey refuses to fold a run of one.
    @Test
    func `a single picture gets the same treatment as a set`() throws {
        let gallery = try #require(
            FeedFixture
                .galleries(in: FeedProjection.rows(from: FeedFixture.looked(at: ["only.png"])))
                .first,
        )

        #expect(gallery.shots.count == 1)
    }

    @Test
    func `the run breaks at the first event that is not a picture`() {
        let interrupted = FeedFixture.looked(at: ["a.png"])
            + [.message(markdown: "That is the one.")]
            + FeedFixture.looked(at: ["b.png", "c.png"])

        let rows = FeedProjection.rows(from: interrupted)

        #expect(rows.count == 3)
        #expect(FeedFixture.galleries(in: rows).map(\.shots.count) == [1, 2])
    }

    /// A thumbnail carries no failure ink, so a call that came back with a picture AND an error
    /// stays a line — in the failure colour, with what went wrong behind it.
    @Test
    func `a failed call holding a picture stays a line rather than joining a gallery`() {
        let broken: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("shot", tool: "Read", kind: .read, naming: "half.png")),
            .toolCallOutcome(ToolCallOutcome(
                id: "shot",
                status: .failed,
                result: FeedFixture.shot(.direct),
                endedAtMs: nil,
                usage: nil,
            )),
        ]

        let rows = FeedProjection.rows(from: broken)

        #expect(FeedFixture.galleries(in: rows).isEmpty)
        #expect(FeedFixture.calls(in: broken).map(\.subject.captioned) == ["half.png"])
    }

    /// A collapsed run of three renders of ONE file is one call and three pictures, and all three
    /// reach the gallery — the collapse counts repeated work, it does not discard what it produced.
    @Test
    func `a collapsed run of renders contributes every picture it stands for`() throws {
        let repeated = (0 ..< 3).flatMap { position -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "render-\(position)",
                    tool: "Read",
                    kind: .read,
                    naming: "chart.png",
                )),
                .toolCallOutcome(TranscriptFixtures.finished(
                    "render-\(position)",
                    FeedFixture.shot(.direct),
                )),
            ]
        }
        let gallery = try #require(
            FeedFixture.galleries(in: FeedProjection.rows(from: repeated)).first,
        )

        #expect(gallery.shots.count == 3)
    }

    /// A call that came back with a picture AND a page of output is not a gallery's. Routing it
    /// there would draw the picture and lose the output, and no fold in this feed loses anything.
    @Test
    func `a call that produced more than pictures stays a line with a panel`() throws {
        let mixed: [TranscriptEvent] = FeedFixture.looked(
            at: "chart.png",
            FeedFixture.shot(.direct),
        ) + [
            .toolCall(FeedFixture.call("again", tool: "Read", kind: .read, naming: "chart.png")),
            .toolCallOutcome(TranscriptFixtures.printed("again", "not an image this time")),
        ]

        let call = try #require(FeedFixture.calls(in: mixed).first)

        #expect(FeedFixture.galleries(in: FeedProjection.rows(from: mixed)).isEmpty)
        #expect(call.evidence.count == 2)
    }

    /// The call that belongs to neither fold: a picture AND a page of output. The gallery would
    /// drop the output and a count would drop the picture, so it keeps a row and the panel both.
    @Test
    func `a run of calls that each produced a picture and output is never folded to a count`() {
        let mixed = (0 ..< 2).flatMap { position -> [TranscriptEvent] in
            let path = "chart-\(position).png"
            return FeedFixture.looked(at: path, FeedFixture.shot(.direct)) + [
                .toolCall(FeedFixture.call(
                    "text-\(position)", tool: "Read", kind: .read, naming: path,
                )),
                .toolCallOutcome(TranscriptFixtures.printed(
                    "text-\(position)",
                    "and a page of it",
                )),
            ]
        }

        let rows = FeedProjection.rows(from: mixed)

        #expect(FeedFixture.surveys(in: rows).isEmpty)
        #expect(FeedFixture.galleries(in: rows).isEmpty)
        #expect(rows.count == 2)
    }
}
