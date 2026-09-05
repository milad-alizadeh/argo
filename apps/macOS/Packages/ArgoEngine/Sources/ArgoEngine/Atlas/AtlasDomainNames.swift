/// What to call a Domain the clustering found (#1157).
///
/// The name has to be the word CONCENTRATED here, not the word weighing the most — those are
/// different, and the difference is the repository's own name. It is in a sixth of this
/// repository's filenames, so it wins any sum, and it names nothing: every Domain here is an Argo
/// domain. So the score is a word's weight in this Domain times the share of that word's whole
/// weight in the repository that falls in it, which no word spread across everything can win.
enum AtlasDomainNames {
    /// How many words a Domain keeps. One word is a poor description of a subject, and the fourth
    /// is already reaching.
    static let kept = 4

    /// The share of a repository's files a word has to be on before it is barred from naming
    /// anything. A word on a quarter of the files — "tests", "view" — is a LAYER, not a subject.
    ///
    /// A bar this loose is deliberate: tightening it until it also caught the repository's own
    /// name would throw away good names, because a real subject can be on a tenth of the files.
    /// The product's own name is not rare, not evenly spread and not detectable from the paths at
    /// all, so it is passed in as a fact rather than guessed at.
    static let houseShare = 0.2

    /// The words no Domain may be named after: the ones on too many files to say anything, plus
    /// the repository's own. Both stay in the vectors, where they are harmless — they are barred
    /// from the LABEL only.
    static func house(over paths: [String], called repository: String) -> Set<String> {
        var documents: [String: Int] = [:]
        for path in paths {
            for word in AtlasNames.tokens(of: path).keys {
                documents[word, default: 0] += 1
            }
        }
        var barred = Set(AtlasNames.words(in: repository))
        for (word, seen) in documents where Double(seen) / Double(paths.count) >= houseShare {
            barred.insert(word)
        }
        return barred
    }

    /// The words that name one Domain, strongest first. Empty where every word it holds is a
    /// house word or is already another Domain's name, which is what an unnamed Domain is.
    static func naming(
        _ members: [Int],
        _ reading: AtlasNaming,
        barring taken: Set<String>,
    )
        -> [String] {
        var here: [String: Double] = [:]
        for member in members {
            for (word, weight) in reading.vectors[member] {
                here[word, default: 0] += weight
            }
        }
        var scored: [(word: String, score: Double)] = []
        for (word, weight) in here
            where !reading.house.contains(word) && !taken.contains(word) {
            let everywhere = reading.spread[word] ?? weight
            scored.append((word, weight * weight / everywhere))
        }
        // Ties break on the word itself: two words concentrated equally would otherwise take
        // turns naming the Domain between one launch and the next.
        scored.sort { $0.score == $1.score ? $0.word < $1.word : $0.score > $1.score }
        return scored.prefix(kept).map(\.word)
    }
}

/// What naming a Domain reads, gathered once for the whole repository: every file's words, the
/// words barred from every label, and how much of each word's weight there is altogether — which
/// is the denominator that turns "heaviest" into "most concentrated".
struct AtlasNaming {
    let vectors: [[String: Double]]
    let house: Set<String>
    let spread: [String: Double]

    init(vectors: [[String: Double]], house: Set<String>) {
        var spread: [String: Double] = [:]
        for vector in vectors {
            for (word, weight) in vector {
                spread[word, default: 0] += weight
            }
        }
        self.vectors = vectors
        self.house = house
        self.spread = spread
    }
}
