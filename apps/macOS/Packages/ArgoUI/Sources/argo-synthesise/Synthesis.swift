import ArgoFixtures
import ArgoUI
import Foundation

/// Making the checked-in synthetic out of a real transcript, and proving it stands for it.
///
/// A synthetic that read as a different document would hand every later gate a shape nobody has,
/// and nothing downstream could tell that from a regression. So both files are projected here, and
/// a difference in any counted fact fails the run rather than being written down.
struct Synthesis {
    let source: URL
    let into: URL

    func run() async throws {
        let lines = try Self.lines(of: source)
        var pass = SyntheticTranscript()
        let synthetic = pass.synthesised(lines: lines)
        let shape = await Self.shape(of: lines)
        let differences = await shape.differences(against: Self.shape(of: synthetic))
        guard differences.isEmpty else { throw Failure.drifted(differences) }
        try write(synthetic, shape: shape)
    }

    /// What the generation could not do, in the words the caller prints.
    enum Failure: Error {
        /// Every number that moved. The fix is a field the pass should have carried through
        /// verbatim, never a looser comparison.
        case drifted([String])
        case unreadable(URL)
    }

    private func write(_ synthetic: [String], shape: SyntheticShape) throws {
        try FileManager.default.createDirectory(at: into, withIntermediateDirectories: true)
        let name = SettledSessionFixture.name
        try (synthetic.joined(separator: "\n") + "\n").write(
            to: into.appending(path: "\(name).jsonl"),
            atomically: true,
            encoding: .utf8,
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        try encoder.encode(shape).write(to: into.appending(path: "\(name).shape.json"))
    }

    private static func shape(of lines: [String]) async -> SyntheticShape {
        await SyntheticShape(lines: lines).adding(FeedRowCensus.counts(ofLines: lines))
    }

    /// The file's lines, without the empty one its trailing newline leaves — a transcript is one
    /// record a line, and a line that is not there is not a record.
    private static func lines(of url: URL) throws -> [String] {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else {
            throw Failure.unreadable(url)
        }
        return text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }
}
