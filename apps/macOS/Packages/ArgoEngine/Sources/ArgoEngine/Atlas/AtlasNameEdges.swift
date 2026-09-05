/// How alike two files are CALLED, as edges (#1157).
///
/// Cosine similarity over the TF-IDF vectors, which for unit vectors is their dot product. Only
/// the strongest few per file are kept, for the reason a Coupling keeps twenty neighbours: a
/// threshold on the value makes a repository whose files are named alike enormous and a repository
/// of terse names empty, where a bound per file follows the file count.
enum AtlasNameEdges {
    /// How many name neighbours a file may keep. The same twenty a Coupling keeps, deliberately:
    /// the two signals are blended into one graph, and a file that could reach forty files by name
    /// and twenty by history would be pulled towards its names by the count rather than by the
    /// evidence.
    static let neighbours = 20

    /// The strongest name ties among `vectors`, by position.
    ///
    /// Walked through an INVERTED index — for each word, which files carry it — so the search
    /// touches only files that share a word with this one. Compared pairwise instead, this
    /// repository's 2,705 files are 3.6 million comparisons of a dictionary each, for an answer
    /// that is almost entirely zeroes.
    static func edges(
        of vectors: [[String: Double]],
        neighbours: Int = neighbours,
    )
        -> [AtlasPair: Double] {
        let carrying = index(of: vectors)
        var edges: [AtlasPair: Double] = [:]
        for (file, vector) in vectors.enumerated() {
            for link in closest(to: file, vector, carrying: carrying).prefix(neighbours) {
                edges[AtlasPair(file, link.node)] = link.weight
            }
        }
        return edges
    }

    /// Which files carry each word, with the weight the word has in each. The whole reason the
    /// search is cheap, and it is built once for the repository.
    private static func index(of vectors: [[String: Double]]) -> [String: [AtlasLink]] {
        var carrying: [String: [AtlasLink]] = [:]
        for (file, vector) in vectors.enumerated() {
            for (word, weight) in vector {
                carrying[word, default: []].append(AtlasLink(node: file, weight: weight))
            }
        }
        return carrying
    }

    /// Every file that shares a word with one file, most alike first.
    ///
    /// Ties break on the other file's own position, because Swift's sort is not stable and two
    /// files named equally like a third would otherwise swap places between runs — one unchanged
    /// repository, two different maps.
    private static func closest(
        to file: Int,
        _ vector: [String: Double],
        carrying: [String: [AtlasLink]],
    )
        -> [AtlasLink] {
        var alike: [Int: Double] = [:]
        for (word, weight) in vector {
            for other in carrying[word] ?? [] where other.node != file {
                alike[other.node, default: 0] += weight * other.weight
            }
        }
        return alike
            .map { AtlasLink(node: $0.key, weight: $0.value) }
            .sorted { $0.weight == $1.weight ? $0.node < $1.node : $0.weight > $1.weight }
    }
}
