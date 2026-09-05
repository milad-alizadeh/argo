/// One inferred grouping of Plots by subject rather than by folder (#1157).
///
/// INFERRED, never measured: it is guessed from what files are called and what changes together,
/// and the recovery literature is blunt that the guess is unreliable — the same technique scores
/// 36 on one codebase and 94 on another. So a Domain is reached only through `AtlasInference`,
/// which carries what the guess is worth, and no reader can hold one without it.
public struct AtlasDomain: Equatable, Sendable {
    /// What to call it: the token most CONCENTRATED in its members, which is not the heaviest one.
    /// The repository's own name is in a sixth of its filenames and wins any sum while naming
    /// nothing, so the score is weight here against the token's weight everywhere.
    public let name: String

    /// The words that named it, strongest first and `name` among them. Kept because one word is a
    /// poor description of a subject and a reader searching for a domain searches these too.
    public let tokens: [String]

    /// The Plots that belong, and how surely each one does. Never empty: a Domain nothing was
    /// placed in is not a Domain that was found, and is not written.
    public let members: [AtlasDomainMember]

    public init(name: String, tokens: [String], members: [AtlasDomainMember]) {
        self.name = name
        self.tokens = tokens
        self.members = members
    }

    /// How sure the Domain is of itself: its members' confidence, averaged. Computed rather than
    /// stored, so it can never disagree with the members it is an average of — the same reason a
    /// Plate carries no number of its own.
    public var confidence: Double {
        guard !members.isEmpty else { return 0 }
        return members.reduce(0) { $0 + $1.confidence } / Double(members.count)
    }

    /// Where the members sit, in the Map's own Plot order.
    public var paths: [String] {
        members.map(\.path)
    }
}

/// One Plot's place in a Domain, and how surely it holds it (#1157).
///
/// A file is allowed to belong to NOTHING: it keeps a Domain only where it is more that Domain
/// than the runner-up by a margin, and the margin is what this carries. The test is a ratio, so
/// it holds no repository-specific scale, and the same number is what a reader draws the file
/// washed out by.
public struct AtlasDomainMember: Equatable, Sendable {
    public let path: String

    /// The margin, 0 to 1: this Domain's pull on the file against the next Domain's, over both.
    ///
    /// Held to three decimals, which is what the file keeps — the same reason `AtlasCoupling`
    /// rounds its strength: a value the file cannot spell back is a Map read that differs from
    /// the Map written.
    public let confidence: Double

    public init(path: String, confidence: Double) {
        self.path = path
        self.confidence = (confidence * 1000).rounded() / 1000
    }
}
