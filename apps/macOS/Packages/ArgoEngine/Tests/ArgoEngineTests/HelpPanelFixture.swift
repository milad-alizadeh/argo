import Foundation
import Testing

/// The `claude` Help panel's Commands tab as a real terminal rendered it, read from the test bundle
/// (#686).
///
/// Captured rather than written: the panel's indents, its truncating ellipsis and its scroll marker
/// are the CLI's own drawing, and a fixture invented here would only prove the parser agrees with
/// whoever invented it.
enum HelpPanelFixture {
    /// A read that reached the end of the list — 99 commands off `claude` 2.1.231.
    static func whole() throws -> [String] {
        try screen("helpCommands")
    }

    /// The SAME panel on a shorter terminal, which stops mid-list and says so with a `↓`.
    static func truncated() throws -> [String] {
        try screen("helpCommandsTruncated")
    }

    private static func screen(_ name: String) throws -> [String] {
        let url = try #require(
            Bundle.module.url(forResource: name, withExtension: "txt", subdirectory: "Fixtures"),
        )
        return try String(contentsOf: url, encoding: .utf8)
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
    }
}
