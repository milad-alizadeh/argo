@testable import ArgoEngine
import Foundation
import Testing

/// Transcript fixtures, read from the test bundle.
///
/// The ones ported from the Electron reader are carried over UNCHANGED: the point of porting them
/// is that both readers answer the same bytes, so editing one to suit Swift would retire the only
/// evidence that they agree. New shapes go in new files rather than into a ported one.
enum Fixture {
    static func lines(_ name: String) throws -> [String] {
        let url = try #require(
            Bundle.module.url(forResource: name, withExtension: "jsonl", subdirectory: "Fixtures"),
        )
        return try String(contentsOf: url, encoding: .utf8)
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
    }

    /// Every event one fixture produces, read by a fresh reader with no disk under it.
    static func events(
        _ name: String,
        readImage: @escaping ImageReader = noImageReader,
        readSkill: @escaping SkillReader = noSkillReader,
    ) async throws
        -> [TranscriptEvent] {
        try await TranscriptReader(readImage: readImage, readSkill: readSkill)
            .read(lines: lines(name))
    }
}
