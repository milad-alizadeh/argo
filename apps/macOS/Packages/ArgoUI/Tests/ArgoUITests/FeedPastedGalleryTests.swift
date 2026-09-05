import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// A picture PASTED into a prompt, and where a run of them starts and stops (#1252). Its own suite
/// beside `FeedGalleryTests`: the run rule is the same one, but everything a pasted run has to
/// keep — the Turn it opened, the address a shot borrows from nothing — is only asked here.
@Suite("Feed galleries of pasted pictures")
struct FeedPastedGalleryTests {
    /// A picture pasted into a prompt is a `.prompt` row, so a run of them used to be one row each
    /// and a column of thumbnails where the reader wanted one grid (#1252).
    @Test
    func `pasted pictures that arrive one after another become one gallery`() throws {
        let rows = FeedProjection.rows(from: Self.pasted(6))
        let gallery = try #require(FeedFixture.galleries(in: rows).first)

        #expect(rows.count == 1)
        #expect(gallery.shots.count == 6)
        #expect(gallery.origin == .pasted)
    }

    /// The run's rule is that pictures are ALL the row holds. Words in a prompt are content, so
    /// the prompt carrying them keeps its own bubble and cuts the run in two.
    @Test
    func `a prompt with words is not part of a picture run`() {
        let asked = Self.pasted(1) + [.prompt(
            text: "the header sits too low",
            images: [FeedFixture.pasted()],
            atMs: nil,
        )] + Self.pasted(2)

        let rows = FeedProjection.rows(from: asked)

        #expect(rows.count == 3)
        #expect(rows[1].kind.words == "the header sits too low")
        #expect(FeedFixture.galleries(in: rows).map(\.shots.count) == [1, 2])
    }

    /// A gallery is never half pasted and half produced: the two runs are two galleries, which is
    /// what keeps the Turn boundary where the prompt that opened it stood.
    @Test
    func `a produced run and a pasted run stay two galleries`() {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: ["shown.png"]) + Self.pasted(2),
        )

        let galleries = FeedFixture.galleries(in: rows)
        #expect(galleries.map(\.origin) == [.produced, .pasted])
        #expect(galleries.map(\.shots.count) == [1, 2])
    }

    /// The fold takes the prompt rows away, so the gallery standing in their place has to be what
    /// they were: the row a Turn opens. Read by the work fold's extents, the Copy Turn menu, the
    /// minimap's prompt band and the composer's echo.
    @Test
    func `a gallery of pasted pictures is still the prompt that opened the Turn`() throws {
        let row = try #require(FeedProjection.rows(from: Self.pasted(2)).first)

        #expect(row.kind.isPrompt)
        #expect(row.kind.isProse)
        #expect(!row.kind.isCall)
        #expect(row.kind.words?.isEmpty == true)
    }

    /// Every shot keeps its own name, which is what the lightbox says. A pasted one has no path to
    /// borrow, so it says what it IS — and the fold must not lose even that.
    @Test
    func `every folded shot keeps its own address`() throws {
        let gallery = try #require(
            FeedFixture.galleries(in: FeedProjection.rows(from: Self.pasted(2))).first,
        )

        #expect(gallery.shots.map(\.address) == [FeedShot.pastedCaption, FeedShot.pastedCaption])
    }

    /// What the record actually leaves behind: `HarnessRecord.shorn` takes the `[Image #n]` token
    /// and at most ONE space with it, so a paste of two pictures, or one on a line of its own,
    /// hands the feed a prompt of whitespace. Read as content, that is the very run this fold is
    /// for, stacked again.
    @Test(arguments: [" ", "\n", "  \n "])
    func `whitespace the token left behind is not words`(leftover: String) {
        let rows = FeedProjection.rows(from: (0 ..< 3).map { _ in
            .prompt(text: leftover, images: [FeedFixture.pasted()], atMs: nil)
        })

        #expect(FeedFixture.galleries(in: rows).map(\.shots.count) == [3])
    }

    /// A prompt of nothing at all is still a row somebody sent. Folding it into a gallery of no
    /// pictures would take a row out of the reading and put an empty grid in its place.
    @Test
    func `a prompt holding neither words nor pictures keeps its own row`() {
        let rows = FeedProjection.rows(from: [.prompt(text: "", images: [], atMs: nil)])

        #expect(FeedFixture.galleries(in: rows).isEmpty)
        #expect(rows.count == 1)
    }

    /// One wordless prompt per picture, which is what pasting several in a row writes. Their
    /// pictures are indistinguishable on purpose: a pasted shot borrows no address, so the count
    /// is the only thing a claim here can be made about.
    private static func pasted(_ pictures: Int) -> [TranscriptEvent] {
        (0 ..< pictures).map { _ in .prompt(text: "", images: [FeedFixture.pasted()], atMs: nil) }
    }
}
