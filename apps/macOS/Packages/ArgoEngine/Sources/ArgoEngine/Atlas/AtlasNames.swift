import Foundation

/// What a file is CALLED, as a bag of weighted words (#1157).
///
/// One of the two signals every repository has, and the one that needs no toolchain, no build and
/// no language support to read — which is why the lexical half of the recovery literature holds
/// its own against the dependency-based half on repositories nobody has set anything up for.
enum AtlasNames {
    /// How much a folder name on the way down counts, and why it is NOTHING by default.
    ///
    /// Feed the directories in and a file under `payments/` gets the word "payments" free, every
    /// file in the folder shares it, and the clustering rediscovers the folder tree. "Domains cut
    /// across folders" would then be a statement about the input rather than a finding about the
    /// repository. It is a parameter rather than a constant so a suite can prove that.
    static let directoryWeight = 0.0

    /// A word has to be at least this long to count. Two letters carry no subject — `io`, `ui`,
    /// `db` — and a bare number is a version or an index rather than a word.
    static let shortestWord = 3

    /// The words in one path, and how often each occurs. The FILENAME only at the default weight,
    /// with its extension dropped: an extension is a language, and every file in a language would
    /// otherwise share a word that says nothing about what any of them is about.
    static func tokens(
        of path: String,
        directoryWeight: Double = AtlasNames.directoryWeight,
    )
        -> [String: Double] {
        var parts = path.split(separator: "/").map(String.init)
        let file = parts.popLast().map(withoutExtension) ?? ""
        var counted: [String: Double] = [:]
        for word in words(in: file) {
            counted[word, default: 0] += 1
        }
        guard directoryWeight > 0 else { return counted }
        for folder in parts {
            for word in words(in: folder) {
                counted[word, default: 0] += directoryWeight
            }
        }
        return counted
    }

    /// Every path as a unit vector of TF-IDF weights, in the order the paths arrived.
    ///
    /// No stop-word list. TF-IDF already flattens a word that is everywhere, and a hand-written
    /// list of words to ignore is exactly the project-specific assumption a map of ANY repository
    /// cannot make. A word that is in every single file is dropped outright rather than weighted
    /// to zero, because `log(N/N)` is zero and a zero-weight entry is a token everything shares
    /// that the neighbour search would still walk.
    static func vectors(
        of paths: [String],
        directoryWeight: Double = AtlasNames.directoryWeight,
    )
        -> [[String: Double]] {
        let counted = paths.map { tokens(of: $0, directoryWeight: directoryWeight) }
        var documents: [String: Int] = [:]
        for bag in counted {
            for word in bag.keys {
                documents[word, default: 0] += 1
            }
        }
        let total = Double(paths.count)
        return counted.map { bag in unit(weighted(bag, against: documents, over: total)) }
    }

    /// One bag as TF-IDF weights, before it is scaled to a unit vector.
    private static func weighted(
        _ bag: [String: Double],
        against documents: [String: Int],
        over total: Double,
    )
        -> [String: Double] {
        var weights: [String: Double] = [:]
        for (word, count) in bag {
            guard let seen = documents[word], Double(seen) < total else { continue }
            weights[word] = count * log(total / Double(seen))
        }
        return weights
    }

    /// The same weights at length 1, so a long filename cannot outweigh a short one on similarity
    /// alone. A vector of nothing stays nothing rather than dividing by zero.
    private static func unit(_ weights: [String: Double]) -> [String: Double] {
        let length = sqrt(weights.values.reduce(0) { $0 + $1 * $1 })
        guard length > 0 else { return [:] }
        return weights.mapValues { $0 / length }
    }

    /// A filename without its extension, and a dotfile left whole: `.gitignore` is a name, not an
    /// extension on an empty name.
    private static func withoutExtension(_ file: String) -> String {
        guard let dot = file.lastIndex(of: "."), dot != file.startIndex else { return file }
        return String(file[file.startIndex ..< dot])
    }

    /// The words in one name, lowercased. Cut at every boundary a programmer writes one at:
    /// punctuation, and the case changes of `camelCase`, `PascalCase` and `HTTPServer` alike.
    static func words(in text: String) -> [String] {
        let characters = Array(text)
        var found: [String] = []
        var current = ""
        for (index, character) in characters.enumerated() {
            guard character.isLetter || character.isNumber else {
                keep(current, in: &found)
                current = ""
                continue
            }
            if breaksWord(at: index, in: characters) {
                keep(current, in: &found)
                current = ""
            }
            current.append(character)
        }
        keep(current, in: &found)
        return found
    }

    /// Whether a new word starts at this character: an upper-case letter after a lower-case one or
    /// a digit (`camelCase`), or the last upper-case letter of a run before a lower-case one
    /// (`HTTPServer`, where the word starts at the S rather than after it).
    private static func breaksWord(at index: Int, in characters: [Character]) -> Bool {
        guard characters[index].isUppercase, index > 0 else { return false }
        let previous = characters[index - 1]
        let next = index + 1 < characters.count ? characters[index + 1] : nil
        return previous.isLowercase || previous.isNumber
            || (previous.isUppercase && next?.isLowercase == true)
    }

    /// One candidate word, kept only if it is long enough and is not a bare number.
    private static func keep(_ word: String, in found: inout [String]) {
        guard word.count >= shortestWord, !word.allSatisfy(\.isNumber) else { return }
        found.append(word.lowercased())
    }
}
