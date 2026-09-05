import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// Finding a file by any part of its path (#1155).
///
/// The rule is one sentence — every term has to appear somewhere in the path — and the claim
/// worth a suite is that it behaves the same on a repository of Swift and a repository of
/// Python. So the cases below are built from a tree carrying both, and the words looked for are
/// the words a reader of either would type.
@Suite("Atlas — finding a file")
struct AtlasSearchTests {
    /// One tree, two languages, and one name that appears in both — `serializer`, which is the
    /// case a rule with ranking in it would answer differently depending on which half of the
    /// repository it learned from.
    private static func map() -> AtlasMap {
        let paths = [
            "root/Sources/Engine/Serializer.swift",
            "root/Sources/Engine/Session.swift",
            "root/Sources/UI/SessionRow.swift",
            "root/service/engine/serializer.py",
            "root/service/engine/session_store.py",
            "root/README.md",
        ]
        return AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "root", children: paths.map {
                .plot(AtlasPlot(path: $0, measures: ["lines": 10]))
            }),
        )
    }

    @Test
    func `part of a name finds the files whose path carries it`() {
        let found = Self.map().files(matching: "serial")
        #expect(found == [
            "root/Sources/Engine/Serializer.swift",
            "root/service/engine/serializer.py",
        ])
    }

    /// The claim the ticket makes in full: one rule, two languages, and no ranking to decide
    /// which of the two answers comes first — they come in the order the Map holds them.
    @Test
    func `the rule is the same on a repo of Swift and a repo of Python`() {
        let map = Self.map()
        #expect(map.files(matching: "session").count == 3)
        // A separator inside the term is part of the path like any other character, so this
        // narrows to the two files that live directly under a folder called `engine` — one in
        // each language, found by one rule.
        #expect(map.files(matching: "engine/session") == [
            "root/Sources/Engine/Session.swift",
            "root/service/engine/session_store.py",
        ])
    }

    @Test
    func `a folder is part of the path, so its name finds what is under it`() {
        #expect(Self.map().files(matching: "Sources/UI") == ["root/Sources/UI/SessionRow.swift"])
    }

    /// Case is not a term of the question: a reader typing `serializer.swift` in lower case is
    /// asking for the file that is spelled with a capital.
    @Test
    func `case is not part of the question`() {
        let map = Self.map()
        #expect(map.files(matching: "SERIALIZER.SWIFT") == map.files(matching: "serializer.swift"))
    }

    /// Several words are an AND over one path, not a phrase: the terms may appear in any order
    /// and anywhere, which is what lets a reader narrow by typing a second word.
    @Test
    func `every word has to appear, in any order`() {
        let map = Self.map()
        #expect(map.files(matching: "engine py") == [
            "root/service/engine/serializer.py",
            "root/service/engine/session_store.py",
        ])
        #expect(map.files(matching: "py engine") == map.files(matching: "engine py"))
        #expect(map.files(matching: "engine ui").isEmpty)
    }

    /// Nothing typed is not a question, and the answer is the whole map rather than none of it —
    /// which is what makes the list a list before the reader has said anything.
    @Test
    func `nothing typed asks nothing, and every file stands`() {
        let map = Self.map()
        #expect(map.files(matching: "") == map.plots.map(\.path))
        #expect(map.files(matching: "   ") == map.plots.map(\.path))
    }

    @Test
    func `a question nothing answers finds nothing`() {
        #expect(Self.map().files(matching: "kubernetes").isEmpty)
    }

    /// The same rule over the committed measurement, so the claim is made against a real
    /// repository's paths rather than a tree written to suit it.
    @Test
    func `the committed measurement answers the same rule`() throws {
        let map = try AtlasMapFixture.argo()
        let found = map.files(matching: "atlas swift")
        #expect(!found.isEmpty)
        for path in found {
            let lowered = path.lowercased()
            #expect(lowered.contains("atlas") && lowered.contains("swift"))
        }
    }
}
