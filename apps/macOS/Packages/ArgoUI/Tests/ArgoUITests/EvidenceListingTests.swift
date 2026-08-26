@testable import ArgoUI
import Testing

/// A read prints the file with the host's line numbers written into the text. Taking that gutter
/// off
/// is what lets the panel draw a read as the file it is — and the rule has to refuse everything
/// that
/// merely LOOKS like one, because what it produces is a claim about which characters are source.
@Suite("Evidence listing")
struct EvidenceListingTests {
    @Test(arguments: [
        ("Claude Code's arrow", "     1→import Foundation\n     2→\n     3→struct Feed {}"),
        ("a tab, as `cat -n` writes it", "1\timport Foundation\n2\t\n3\tstruct Feed {}"),
        ("no trailing newline", "     1→import Foundation\n     2→\n     3→struct Feed {}"),
        ("a trailing newline", "     1→import Foundation\n     2→\n     3→struct Feed {}\n"),
    ])
    func `a numbered listing is read as the file it printed`(named: (String, String)) throws {
        let listing = try #require(EvidenceListing(named.1), "\(named.0)")

        #expect(listing.lines.map(\.number) == [1, 2, 3])
        #expect(listing.lines.map(\.text) == ["import Foundation", "", "struct Feed {}"])
    }

    /// A read of the middle of a file starts wherever it starts. What makes the column a gutter is
    /// that it never skips, not that it opens on 1.
    @Test
    func `a read that started partway through the file keeps the host's own numbers`() throws {
        let listing = try #require(EvidenceListing("   86→  let cwd: String?\n   87→}"))

        #expect(listing.lines.map(\.number) == [86, 87])
    }

    /// The file without the host's numbers in it. A renderer handed the gutter draws `    12→##` as
    /// a paragraph opening on a number, so the characters of the FILE have to be recoverable.
    @Test
    func `a listing gives back the file with its gutter taken off`() throws {
        let listing = try #require(EvidenceListing("     1→## What I found\n     2→\n     3→Done."))

        #expect(listing.text == "## What I found\n\nDone.")
        #expect(listing.hasGutter)
    }

    /// A file Argo read itself arrives with no gutter at all. It is still the file — it just has no
    /// numbers, and none are invented for it.
    @Test
    func `a file that arrived without a gutter is numbered by nobody`() {
        let listing = EvidenceListing(file: "## What I found\n\nDone.\n")

        #expect(listing.lines.map(\.number) == [nil, nil, nil])
        #expect(listing.text == "## What I found\n\nDone.")
        #expect(!listing.hasGutter)
    }

    /// What may be RENDERED: a gutter that came off cleanly, and characters that never had one.
    /// Half a gutter is a guess either way it is resolved.
    @Test(arguments: [
        // A clean listing, and characters that never carried a gutter.
        ("     1→# Cockpit\n     2→Done.", true),
        ("# Cockpit\n\nDone.", true),
        // A gutter on only some lines.
        ("     1→# Cockpit\n(Results truncated)", false),
    ])
    func `only a text with all of its gutter or none of it can be rendered`(
        read: (String, Bool),
    ) {
        #expect(EvidenceListing.read(read.0).isRenderable == read.1)
    }

    /// A read of the middle of a file is a slice, and the numbers are the only thing saying so.
    @Test(arguments: [
        ("     1→# Cockpit\n     2→Done.", true),
        // Partway through the file, and a text whose numbers say nothing at all.
        ("   86→## What I found\n   87→Done.", false),
        ("# Cockpit", true),
    ])
    func `a listing knows whether it opens the file`(read: (String, Bool)) {
        #expect(EvidenceListing.read(read.0).opensTheFile == read.1)
    }

    @Test(arguments: [
        ("ordinary output", "Building for debugging...\n[1/3] Compiling ArgoUI"),
        ("output that opens on a digit", "3 files changed\n2 insertions"),
        ("a table of numbers that skips", "1\tone\n3\tthree"),
        ("numbers that repeat", "1\tone\n1\tone"),
        ("a delimiter that is not a gutter", "1: one\n2: two"),
        ("one numbered line among prose", "     1→import Foundation\nDone."),
        ("nothing at all", ""),
    ])
    func `anything that is not a listing is left exactly as it arrived`(named: (String, String)) {
        #expect(EvidenceListing(named.1) == nil, "\(named.0)")
    }
}
