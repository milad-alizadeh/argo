import ArgoEngine
@testable import ArgoUI
import Testing

/// A picture is the one result that gets worse the smaller it is drawn, so a run of them becomes a
/// row of thumbnails rather than a run of filenames. The claims here are about where that run
/// starts and stops, and about each shot still saying honestly where its pixels came from.
@Suite("Feed galleries")
struct FeedGalleryTests {
    @Test
    func `consecutive pictures render as one gallery`() throws {
        let rows = FeedProjection.rows(from: showing(["a.png", "b.png", "c.png"]))
        let gallery = try #require(FeedFixture.galleries(in: rows).first)

        #expect(rows.count == 1)
        #expect(gallery.shots.map(\.name) == ["a.png", "b.png", "c.png"])
    }

    /// A gallery of one is still a gallery. `Read 1` loses an address and saves nothing, which is
    /// why the survey refuses to fold a run of one — but one thumbnail is a picture where there
    /// was a filename, so the treatment does not change with the count.
    @Test
    func `a single picture gets the same treatment as a set`() throws {
        let gallery = try #require(
            FeedFixture.galleries(in: FeedProjection.rows(from: showing(["only.png"]))).first,
        )

        #expect(gallery.shots.count == 1)
    }

    @Test
    func `the run breaks at the first event that is not a picture`() {
        let interrupted = showing(["a.png"])
            + [.message(markdown: "That is the one.")]
            + showing(["b.png", "c.png"])

        let rows = FeedProjection.rows(from: interrupted)

        #expect(rows.count == 3)
        #expect(FeedFixture.galleries(in: rows).map(\.shots.count) == [1, 2])
    }

    /// Four provenances, four treatments. Which one a shot gets is derived from the evidence, so
    /// the frame it is drawn in and the words under it cannot come apart.
    @Test(arguments: [
        Reading(tier: .direct, hasBytes: true, provenance: .captured),
        Reading(tier: .derived, hasBytes: true, provenance: .current),
        Reading(tier: .convention, hasBytes: true, provenance: .rendered),
        Reading(tier: .direct, hasBytes: false, provenance: .absent),
    ])
    func `a shot reads its provenance off the evidence`(_ reading: Reading) throws {
        let result = FeedFixture.shot(
            reading.tier,
            bytes: reading.hasBytes ? FeedFixture.onePixelPNG : nil,
        )
        let rows = FeedProjection.rows(from: FeedFixture.looked(at: "shot.png", result))
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.provenance == reading.provenance)
    }

    /// One row of the table above: what the record carried, and what the gallery must say about it.
    struct Reading: Sendable {
        let tier: Tier
        let hasBytes: Bool
        let provenance: MediaProvenance
    }

    /// A shot the record kept no bytes for is drawn and is not a control. It is still IN the
    /// gallery — the call happened, and dropping it would be the fold reporting five renders where
    /// six were asked for.
    @Test
    func `a picture the record kept no bytes for is shown and opens nothing`() throws {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: "gone.png", FeedFixture.shot(.direct, bytes: nil)),
        )
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.isOpenable == false)
        #expect(shot.provenance.words == nil)
    }

    /// Bytes are not a picture. A record can carry a string that decodes to nothing, and a shot
    /// that read only "were there bytes" would draw an absence and offer a click onto it — the one
    /// combination the absent case exists to prevent.
    @Test
    func `a picture whose bytes decode to nothing reads as an absence`() throws {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: "torn.png", FeedFixture.shot(.direct, bytes: "not-a-png")),
        )
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.provenance == .absent)
        #expect(shot.isOpenable == false)
    }

    /// The frame is the fact, so it is derived beside the words rather than decided inside the view
    /// that draws it: a capture bleeds, a re-read and an absence wear the broken edge the shell
    /// already uses for a weaker claim, and a render sits mounted because it was never captured off
    /// anything.
    @Test(arguments: [
        Framing(provenance: .captured, treatment: .bleeding),
        Framing(provenance: .current, treatment: .broken),
        Framing(provenance: .rendered, treatment: .mounted),
        Framing(provenance: .absent, treatment: .broken),
    ])
    func `each provenance is framed as its own treatment`(_ framing: Framing) {
        #expect(framing.provenance.treatment == framing.treatment)
    }

    /// One row of the table above: a provenance, and the frame it is drawn in.
    struct Framing: Sendable {
        let provenance: MediaProvenance
        let treatment: MediaProvenance.Treatment
    }

    /// A failed call is the loudest thing in a run and a thumbnail carries no failure ink, so a
    /// call that came back with a picture AND an error stays a line — in the failure colour, with
    /// what went wrong behind it. The same reason the survey never folds one.
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

    @Test
    func `every picture that has bytes opens`() throws {
        let rows = FeedProjection.rows(from: showing(["a.png", "b.png"]))
        let gallery = try #require(FeedFixture.galleries(in: rows).first)

        #expect(gallery.shots.map(\.isOpenable) == [true, true])
    }

    /// The thumbnail names the file; the lightbox names the path. Both come off the shot, because
    /// the row standing over a gallery names no file at all.
    @Test
    func `a shot carries the filename it is captioned by and the path it opens onto`() throws {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: "docs/renders/at-rest.png", FeedFixture.shot(.direct)),
        )
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.name == "at-rest.png")
        #expect(shot.address == "docs/renders/at-rest.png")
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
                .toolCallOutcome(FeedFixture.answered(
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
            .toolCallOutcome(FeedFixture.answered(
                "again",
                .output(OutputEvidence(tier: .direct, text: "not an image this time")),
            )),
        ]

        let call = try #require(FeedFixture.calls(in: mixed).first)

        #expect(FeedFixture.galleries(in: FeedProjection.rows(from: mixed)).isEmpty)
        #expect(call.evidence.count == 2)
    }

    /// The call that belongs to neither fold: a picture AND a page of output. The gallery will not
    /// take it, because drawing it would drop the output — and the survey must not take it either,
    /// because a count would drop the picture. It keeps a row, and the panel keeps both halves.
    @Test
    func `a run of calls that each produced a picture and output is never folded to a count`() {
        let mixed = (0 ..< 2).flatMap { position -> [TranscriptEvent] in
            let path = "chart-\(position).png"
            return FeedFixture.looked(at: path, FeedFixture.shot(.direct)) + [
                .toolCall(FeedFixture.call(
                    "text-\(position)", tool: "Read", kind: .read, naming: path,
                )),
                .toolCallOutcome(FeedFixture.answered(
                    "text-\(position)",
                    .output(OutputEvidence(tier: .direct, text: "and a page of it")),
                )),
            ]
        }

        let rows = FeedProjection.rows(from: mixed)

        #expect(FeedFixture.surveys(in: rows).isEmpty)
        #expect(FeedFixture.galleries(in: rows).isEmpty)
        #expect(rows.count == 2)
    }

    private func showing(_ paths: [String]) -> [TranscriptEvent] {
        paths.flatMap { FeedFixture.looked(at: $0, FeedFixture.shot(.direct)) }
    }
}
