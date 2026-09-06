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

    /// Where the Domain stands in the inference, largest first and 0 at the front — the file's own
    /// order, which is what the Map file spells by writing them in it.
    ///
    /// **Carried rather than counted at the point of use (#1158).** A Domain's colour is the wheel
    /// walked by this number, and narrowing a Map drops Domains that lost every member: read off
    /// an array position, the rank of every Domain past the one that emptied would shift, and the
    /// whole map would repaint the moment a reader hid the tests or went into a region. It is
    /// assigned once, where the inference is read or produced, and survives every narrowing.
    public let rank: Int

    public init(name: String, tokens: [String], members: [AtlasDomainMember], rank: Int = 0) {
        self.name = name
        self.tokens = tokens
        self.members = members
        self.rank = rank
    }

    /// Where the members sit, in the Map's own Plot order.
    public var paths: [String] {
        members.map(\.path)
    }

    /// How surely the Domain holds its files ON AVERAGE, 0 to 1 — what a swatch standing for the
    /// whole region is washed out by, in the legend and in the rail beside the map (#1158).
    ///
    /// DERIVED from the members and never stored, so it cannot come to disagree with them. A mean
    /// rather than the least or the greatest: a region of forty files where one barely holds on is
    /// not an unsure region, and a region where one file is certain is not a sure one.
    ///
    /// Never divides by nothing: a Domain nothing was placed in is not written (`members` is never
    /// empty), and 0 here would read as "we are sure of nothing" rather than as "there is nothing".
    public var confidence: Double {
        guard !members.isEmpty else { return 0 }
        return members.reduce(0) { $0 + $1.confidence } / Double(members.count)
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
    /// Held to what the file keeps, like every other number in the Map (`heldByTheMapFile`).
    public let confidence: Double

    public init(path: String, confidence: Double) {
        self.path = path
        self.confidence = confidence.heldByTheMapFile
    }
}
