@testable import AtlasLayout
import Testing

/// What counts as a test file for the "hide test files" filter (#1161). A path heuristic, checked
/// against the conventions of the languages a repository is likeliest to be written in — the map
/// has no parser to ask instead.
@Suite("Atlas — which files are tests")
struct AtlasTestFileTests {
    @Test(arguments: [
        "Sources/Atlas/Tests/AtlasMap.swift",
        "argo/apps/macOS/Packages/ArgoAtlas/Tests/AtlasLayoutTests/AtlasPlanTests.swift",
        "src/__tests__/widget.js",
        "src/components/Widget.spec.ts",
        "src/components/widget.test.tsx",
        "pkg/widget_test.go",
        "tests/test_widget.py",
        "scripts/test_migration.py",
        "apps/macOS/Packages/ArgoAtlas/Sources/AtlasLayout/AtlasChannelsTests.swift",
        "Sources/Widget/WidgetTest.swift",
        "Sources/Widget/test.swift",
    ])
    func `a conventional test path reads as a test`(_ path: String) {
        #expect(AtlasPath.isTest(path))
    }

    @Test(arguments: [
        "Sources/Atlas/AtlasMap.swift",
        "src/components/Widget.tsx",
        "docs/latest.md",
        "Sources/Widget/Attestation.swift",
        "src/contest/results.ts",
        // The suffix is a whole word or it is nothing: these are three real files a substring
        // match would have hidden from the map, and from the ranges the legend is cut against.
        "Sources/Feed/Latest.swift",
        "Sources/Bench/Fastest.swift",
        "Sources/Roster/Greatest.swift",
    ])
    func `an ordinary path does not read as a test`(_ path: String) {
        #expect(!AtlasPath.isTest(path))
    }
}
