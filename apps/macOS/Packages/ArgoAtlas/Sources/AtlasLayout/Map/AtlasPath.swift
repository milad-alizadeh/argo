/// A Map path, read. One place rather than four: a Plot, a Plate and both of their placements in a
/// plan all answer what they are called, and four copies of one split is four chances to disagree
/// about a file called `a/b/`.
enum AtlasPath {
    /// What the node at a path is called on disk — the last component, and the whole path for a
    /// root that has none.
    static func name(of path: String) -> String {
        String(path.split(separator: "/").last ?? "")
    }

    /// What holds the node at a path — everything in front of the last component, and nothing at
    /// all for a root that has none. The other half of `name(of:)`, and here for the same reason:
    /// a list sets the two differently, and a second split spelled at the call site is a second
    /// answer about a file called `a/b/`.
    static func folder(of path: String) -> String {
        path.split(separator: "/").dropLast().joined(separator: "/")
    }

    /// A directory component conventionally reserved for tests, in any of the languages the map
    /// has no parser for. Matched whole, not as a substring — a plate named `latest` must not
    /// read as one named `test`.
    private static let testDirectories: Set<String> = [
        "test", "tests", "__tests__", "spec", "specs", "testing",
    ]

    /// A filename suffix, matched case-insensitively, that names its file a test on its own — the
    /// JS/TS convention, where the dot in front of it is what makes the match a whole word.
    private static let testFileSuffixes: [String] = [
        ".test.ts", ".test.tsx", ".test.js", ".test.jsx",
        ".spec.ts", ".spec.tsx", ".spec.js", ".spec.jsx",
    ]

    /// The Swift convention — XCTest's and swift-testing's — and the one that cannot be matched
    /// case-insensitively: the CAPITAL is the only boundary between `WidgetTests.swift`, which is
    /// a test, and `Latest.swift`, which is a file about the latest of something. Lowercasing
    /// first destroys it and hides real files from the map, so this reads the name as written.
    private static let testNameSuffixes = ["Test", "Tests"]

    /// Whether the file at this path counts as a test, for the "hide test files" filter (#1161).
    ///
    /// A path heuristic rather than a language-aware one: the Map has no parser, and is built for
    /// a repository in any language a generator can walk (#1140). It reads as a test if it sits
    /// under a directory named for tests, or if its own name says so — `test_` and `_test`,
    /// Python's and Go's own convention, or a suffix naming a Swift, JS or TS test file.
    static func isTest(_ path: String) -> Bool {
        let components = path.split(separator: "/").map(String.init)
        guard let fileName = components.last else { return false }
        if components.dropLast().contains(where: { testDirectories.contains($0.lowercased()) }) {
            return true
        }
        let lowered = fileName.lowercased()
        if testFileSuffixes.contains(where: lowered.hasSuffix) || isSwiftTest(fileName) {
            return true
        }
        let stem = lowered.split(separator: ".").first.map(String.init) ?? lowered
        return stem.hasPrefix("test_") || stem.hasSuffix("_test")
    }

    /// A Swift source whose own name ends at `Test` or `Tests`, read as written so the capital is
    /// the boundary. A file called nothing but `test.swift` is one too, which is the one place the
    /// case cannot be the boundary because there is nothing in front of it.
    private static func isSwiftTest(_ fileName: String) -> Bool {
        let suffix = ".swift"
        guard fileName.lowercased().hasSuffix(suffix) else { return false }
        let stem = String(fileName.dropLast(suffix.count))
        return testNameSuffixes.contains(stem.capitalized)
            || testNameSuffixes.contains(where: stem.hasSuffix)
    }
}
