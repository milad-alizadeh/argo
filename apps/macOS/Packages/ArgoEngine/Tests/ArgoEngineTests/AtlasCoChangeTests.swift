@testable import ArgoEngine
import AtlasLayout
import Testing

/// What the counting makes of a history, over histories written here rather than committed as a
/// repository: the two thresholds are the whole decision, and each needs a history shaped to put
/// it — one sweeping commit, or a file with more company than it may keep — which no fixture
/// repository of nine files can hold at once. What the counting makes of a REAL repository is
/// `AtlasGenerationTests`.
@Suite("Atlas co-change")
struct AtlasCoChangeTests {
    private func couplings(
        _ commits: [[String]],
        among paths: [String],
    )
        -> [AtlasCoupling] {
        AtlasCoChange.couplings(over: commits, among: paths, under: "repository")
    }

    private func strength(
        _ couplings: [AtlasCoupling],
        between first: String,
        and second: String,
    )
        -> Double? {
        couplings.first {
            [$0.first, $0.second] == ["repository/" + first, "repository/" + second]
        }?.strength
    }

    @Test func `two files that always change together are wholly coupled`() {
        // Jaccard is 1 only when neither file has ever changed without the other, which is the
        // reading the number has to carry for a top-N list to mean anything.
        let couplings = couplings(
            [["a.swift", "b.swift"], ["a.swift", "b.swift"]], among: ["a.swift", "b.swift"],
        )

        #expect(strength(couplings, between: "a.swift", and: "b.swift") == 1)
    }

    @Test func `a file that changes on every commit is not coupled to the whole repository`() {
        // The reason this is Jaccard and not a raw count, and not the shared count over the
        // smaller of the two: a lockfile touched by every commit shares every commit with
        // everything, which is a fact about the lockfile and never about a pair.
        let couplings = couplings(
            [
                ["lock.json", "a.swift"], ["lock.json", "b.swift"],
                ["lock.json", "c.swift"], ["lock.json", "a.swift"],
            ],
            among: ["lock.json", "a.swift", "b.swift", "c.swift"],
        )

        #expect(strength(couplings, between: "lock.json", and: "a.swift") == 0.5)
        #expect(strength(couplings, between: "lock.json", and: "b.swift") == 0.25)
    }

    @Test func `a pair is stated once, and reads the same from either end`() {
        let couplings = couplings(
            [["a.swift", "b.swift"], ["b.swift", "a.swift"]], among: ["a.swift", "b.swift"],
        )

        #expect(couplings.count == 1)
        let coupling = try? #require(couplings.first)
        #expect(coupling?.partner(of: "repository/a.swift") == "repository/b.swift")
        #expect(coupling?.partner(of: "repository/b.swift") == "repository/a.swift")
    }

    @Test func `one sweeping commit does not couple everything to everything`() {
        // The cap. A formatter run over a hundred files would otherwise state 4,950 ties, every
        // one of them a fact about the formatter rather than about the code.
        let sweep = (0 ..< 100).map { "file\($0).swift" }
        let history = [sweep] + (0 ..< 20).map { _ in ["a.swift", "b.swift"] }

        let couplings = couplings(history, among: sweep + ["a.swift", "b.swift"])

        #expect(couplings.count == 1)
        #expect(strength(couplings, between: "a.swift", and: "b.swift") == 1)
    }

    @Test func `the cap is the repository's own size, not a number chosen here`() {
        // A repository whose commits are all broad keeps them: the cap is a percentile of what
        // this history does, so a repository of large commits is not measured as if it were this
        // one.
        let paths = (0 ..< 30).map { "file\($0).swift" }
        let history = (0 ..< 10).map { _ in paths }

        #expect(!couplings(history, among: paths).isEmpty)
    }

    @Test func `a file keeps its strongest neighbours and no more`() {
        // The list is bounded per FILE, so what is written follows the file count rather than how
        // busy the history is. A clique of `neighbours + 1` files fills every member's list with
        // ties at 0.83, and `late.swift` — which changed once with each of them, at 0.03 — is
        // kept by nobody in the clique and keeps only as many of them as it is allowed.
        let clique = (0 ... AtlasCoChange.neighbours).map { "file\($0).swift" }
        let history = Array(repeating: clique, count: 10)
            + clique.map { ["late.swift", $0] }

        let couplings = couplings(history, among: clique + ["late.swift"])

        let kept = couplings.compactMap { $0.partner(of: "repository/late.swift") }
        #expect(kept.count == AtlasCoChange.neighbours)
        // The ties are equal, so which are kept is settled by the file's own position rather than
        // by whichever the counting reached first.
        #expect(kept.contains("repository/file0.swift"))
        #expect(!kept.contains("repository/file\(AtlasCoChange.neighbours).swift"))
    }

    @Test func `a repository of one commit states no couplings`() {
        // Every file in a first commit arrived together, which is not the same fact as changing
        // together — and the repository still gets a map.
        #expect(couplings([["a.swift", "b.swift"]], among: ["a.swift", "b.swift"]).isEmpty)
        #expect(couplings([], among: ["a.swift"]).isEmpty)
    }

    @Test func `a file the working tree no longer holds is nobody's company`() {
        // A Coupling is read beside a file on the map, and a file deleted three years ago has no
        // Plot to be read beside.
        let couplings = couplings(
            [["a.swift", "gone.swift"], ["a.swift", "gone.swift"]], among: ["a.swift"],
        )

        #expect(couplings.isEmpty)
    }

    @Test func `the couplings come out in one settled order`() {
        // Pairs are counted in dictionaries, and a dictionary walked in its own order is how app
        // data comes out different on every run of the same measurement. Asserted as the order
        // itself rather than by counting twice: two calls in one process share a hash seed, so
        // they would agree even where two runs of the app would not.
        // Named to two digits, so the order the couplings claim — the Map's own — is one a reader
        // can check by reading the paths.
        let paths = (10 ..< 40).map { "file\($0).swift" }

        let counted = couplings([paths, paths.reversed()], among: paths)

        let order = counted.map { [$0.first, $0.second] }
        #expect(order == order.sorted { $0.lexicographicallyPrecedes($1) })
        #expect(Set(order).count == order.count)
    }
}
