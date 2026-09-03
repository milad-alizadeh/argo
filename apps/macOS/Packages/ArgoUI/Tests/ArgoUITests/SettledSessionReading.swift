import ArgoFixtures
@testable import ArgoUI
import Foundation

/// Reading the settled-session fixture the way its two suites need it.
enum SettledSessionReading {
    /// Whether the real transcript is on this machine, said out loud on the way to skipping: a run
    /// that did not make that comparison says so in its own output as well as in the skip line.
    static var realIsPresent: Bool {
        let path = SettledSessionFixture.real.path
        guard FileManager.default.fileExists(atPath: path) else {
            print("""
            SKIP settled-session-real — no transcript at \(path). The synthetic is what every gate \
            measures; copy a real one there and run `sh apps/macOS/scripts/synthesise-fixture.sh` \
            to check that it still stands for one.
            """)
            return false
        }
        return true
    }

    static func lines(of url: URL) throws -> [String] {
        try String(contentsOf: url, encoding: .utf8)
            .split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }

    /// Every counted fact about a reading: its records, and the rows they project to.
    static func shape(of lines: [String]) async -> SyntheticShape {
        await SyntheticShape(lines: lines).adding(FeedRowCensus.counts(ofLines: lines))
    }

    /// The facts under the names given, so a case compares the half of the shape it is about.
    static func named(_ prefixes: [String], in shape: SyntheticShape) -> SyntheticShape {
        SyntheticShape(counts: shape.counts.filter { fact in
            prefixes.contains { fact.key == $0 || fact.key.hasPrefix("\($0).") }
        })
    }

    /// Every string in one record, paired with the key it sat under — a key itself paired with
    /// `nil`, since nothing decided to keep it.
    ///
    /// What the copy-through case walks: a value is only as synthetic as the rule that let it
    /// past, and a key is prose as often as a schema name (`answers` is keyed by the question).
    static func strings(in raw: Any, under key: String? = nil) -> [(key: String?, text: String)] {
        switch raw {
        case let text as String: [(key, text)]
        case let record as [String: Any]:
            record.flatMap { field in
                [(key: String?.none, text: field.key)] + strings(in: field.value, under: field.key)
            }
        case let list as [Any]: list.flatMap { strings(in: $0, under: key) }
        default: []
        }
    }
}
