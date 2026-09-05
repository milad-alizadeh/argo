@testable import ArgoEngine
import Testing

/// What a filename is worth as a signal, over names written here rather than measured: every
/// claim below is about one rule of the reading — where a word ends, which words are dropped, and
/// what a word that is everywhere is worth.
@Suite("Atlas — what files are called")
struct AtlasNamesTests {
    @Test func `a name is cut where a programmer wrote the boundary`() {
        #expect(AtlasNames.words(in: "SessionRosterRow") == ["session", "roster", "row"])
        #expect(AtlasNames.words(in: "session_roster-row") == ["session", "roster", "row"])
        #expect(AtlasNames.words(in: "HTTPServerPool") == ["http", "server", "pool"])
        // A digit inside a word stays in it — `utf8`, `sha256`, `atlas2` are words — and only a
        // word that is nothing BUT digits is dropped.
        #expect(AtlasNames.words(in: "atlas2Map") == ["atlas2", "map"])
    }

    @Test func `a word too short to carry a subject is dropped, and so is a bare number`() {
        // `io` and `db` name a layer at best; `2` is a version or an index. Neither says what a
        // file is about, and both are on enough files to pull a domain together out of nothing.
        #expect(AtlasNames.words(in: "io-db-2-ticket") == ["ticket"])
    }

    @Test func `the extension is not a word, but a dotfile is a name`() {
        // Every Swift file in the repository would otherwise share "swift", which says what
        // language it is and nothing about what it is about.
        #expect(AtlasNames.tokens(of: "argo/Sources/Ticket.swift").keys.sorted() == ["ticket"])
        #expect(AtlasNames.tokens(of: "argo/.gitignore").keys.sorted() == ["gitignore"])
    }

    @Test func `directory names count for nothing unless they are asked for`() {
        // The default that keeps "domains cut across folders" a finding about the repository
        // rather than a statement about the input: feed the folders in and every file under
        // `payments/` shares a word, and the clustering rediscovers the folder tree.
        #expect(AtlasNames.tokens(of: "argo/payments/Refund.swift").keys.sorted() == ["refund"])

        let asked = AtlasNames.tokens(of: "argo/payments/Refund.swift", directoryWeight: 0.5)

        #expect(asked["payments"] == 0.5)
        #expect(asked["refund"] == 1)
    }

    @Test func `a word every file carries is worth nothing and is not carried at all`() {
        // `log(N/N)` is zero, so the weight would be zero anyway. Dropping it outright keeps the
        // neighbour search off a word that joins every file to every other file.
        let vectors = AtlasNames.vectors(of: [
            "argo/TicketService.swift", "argo/SessionService.swift", "argo/DeckService.swift",
        ])

        #expect(vectors.allSatisfy { $0["service"] == nil })
        #expect(vectors[0]["ticket"] != nil)
    }

    @Test func `a vector is one unit long, whatever the name is`() {
        // So a file with six words in its name cannot be more like everything than a file with
        // two, on length alone.
        let vectors = AtlasNames.vectors(of: [
            "argo/TicketProviderBindingRosterRow.swift", "argo/Deck.swift", "argo/Ticket.swift",
        ])

        for vector in vectors where !vector.isEmpty {
            let length = vector.values.reduce(0) { $0 + $1 * $1 }
            #expect(abs(length - 1) < 0.000_001)
        }
    }
}

/// The edges the names make: which files a file is nearest to, and how the search is bounded.
@Suite("Atlas — the ties between names")
struct AtlasNameEdgesTests {
    /// Words rather than numbers, because a bare number is not a word the reading keeps.
    private static let spelt = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]

    @Test func `two files sharing a rare word are tied, and two sharing nothing are not`() {
        let paths = ["argo/TicketRow.swift", "argo/TicketList.swift", "argo/Shader.metal"]
        let edges = AtlasNameEdges.edges(of: AtlasNames.vectors(of: paths))

        #expect(edges[AtlasPair(0, 1)] != nil)
        #expect(edges[AtlasPair(0, 2)] == nil)
    }

    @Test func `a file keeps only its strongest few neighbours`() {
        // The bound is on the FILE, so what is written follows the file count rather than how
        // alike a repository's names happen to be. The odd file out is what keeps "ticket" from
        // being a word every file carries, which is dropped before any of this.
        let named = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"]
        let paths = named.map { "argo/Ticket\($0)Row.swift" } + ["argo/Shader.metal"]
        let edges = AtlasNameEdges.edges(of: AtlasNames.vectors(of: paths), neighbours: 2)

        for file in named.indices {
            let kept = edges.keys.filter { $0.first == file || $0.second == file }
            // The union of both ends' lists, so a file can be kept BY more files than it keeps.
            #expect(kept.count >= 2)
        }
        #expect(edges.count < paths.count * (paths.count - 1) / 2)
    }

    @Test func `the same names make the same edges twice`() {
        // Two runs over one unchanged repository must draw one map. Dictionaries are walked in
        // their own order, so every ordering the search depends on is settled by hand.
        let paths = (0 ..< 30).map {
            "argo/\(Self.spelt[$0 % 5])Ticket\(Self.spelt[$0 % 3])Row.swift"
        }
        let vectors = AtlasNames.vectors(of: paths)

        #expect(AtlasNameEdges.edges(of: vectors, neighbours: 3)
            == AtlasNameEdges.edges(of: vectors, neighbours: 3))
    }
}
