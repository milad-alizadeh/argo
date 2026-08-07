import Foundation
import Testing
@testable import ArgoEngine

/// The Electron reader's own fixtures, read from the test bundle.
///
/// Carried over unchanged: the point of porting them is that both readers answer the same bytes, so
/// editing one to suit Swift would retire the only evidence that they agree.
enum Fixture {
    static func lines(_ name: String) throws -> [String] {
        let url = try #require(
            Bundle.module.url(forResource: name, withExtension: "jsonl", subdirectory: "Fixtures")
        )
        return try String(contentsOf: url, encoding: .utf8)
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
    }

    /// Every event one fixture produces, read by a fresh reader with no disk under it.
    static func events(_ name: String, readImage: @escaping ImageReader = noImageReader) async throws
        -> [TranscriptEvent]
    {
        await TranscriptReader(readImage: readImage).read(lines: try lines(name))
    }
}
