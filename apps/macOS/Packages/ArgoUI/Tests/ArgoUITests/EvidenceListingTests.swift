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
