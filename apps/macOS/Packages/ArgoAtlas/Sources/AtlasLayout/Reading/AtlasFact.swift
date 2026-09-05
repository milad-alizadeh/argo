/// One of the four things a reader is told plainly about a file, in the generator's own word for
/// it (#1154).
///
/// An enum rather than four strings, because these four are not a subset of the Measure set the
/// reader chooses from — they are the ones a person already understands without being shown a
/// range. The design's own rule: "Counts and dates are numbers a reader already understands, so
/// they cost one line instead of four table rows. Ranking them said nothing the number did not."
///
/// The raw value IS the Measure name, so nothing has to keep a second table of which word means
/// which fact.
public enum AtlasFact: String, Equatable, Sendable, CaseIterable {
    case lines
    case authors
    case commits
    /// Whole weeks since the last commit, which is what the generator records. The reader is told
    /// it in whatever unit is legible at that age, and that spelling is the view's.
    case age = "age_in_weeks"

    /// The Measure this fact is measured as, exactly as the Map spells it.
    public var measure: String {
        rawValue
    }

    /// What the fact is called in a sentence — "lines", "authors", and the age's own word for the
    /// number in front of it, which is not the Measure's name at all.
    ///
    /// Here rather than in the panel because it is the same word whether there is a figure to put
    /// in front of it or not: with one, the reader gets "47 commits"; with none, "commits not
    /// measured". A second table of nouns beside the first is how those two come to disagree.
    public var noun: String {
        switch self {
        case .lines: "lines"
        case .authors: "authors"
        case .commits: "commits"
        case .age: "age"
        }
    }

    /// The same word for one of a thing — "1 authors" is a sentence nobody writes, and the panel
    /// is read as English rather than as a table. The age has no plural: the figure in front of it
    /// already carries its unit.
    public func counted(_ value: Double) -> String {
        guard self != .age else { return "old" }
        return value == 1 ? String(noun.dropLast()) : noun
    }
}

/// One fact of a file, read: which fact, and what this file measures for it.
public struct AtlasFactReading: Equatable, Sendable {
    public let fact: AtlasFact

    /// Nothing where this file carries no usable value for the Measure — a file git has no history
    /// for carries no commits rather than zero of them, and a reader told "0 commits" would
    /// believe a number nobody measured (#1154's "a file with a missing measure says so rather
    /// than showing zero").
    public let value: Double?

    public init(fact: AtlasFact, value: Double?) {
        self.fact = fact
        self.value = value
    }
}
