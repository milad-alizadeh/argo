import Foundation

/// Argo's own table of model ids to the names people use for them. Staleable by construction: the
/// ids belong to the providers, so the lookup's fallback is the id VERBATIM rather than a family
/// guessed off its prefix.
///
/// A pure data catalog, the one file shape `.swiftlint.yml` exempts from the line ceiling.
enum ReadableModelName {
    /// Provider ids, exactly as a transcript spells them, without any date suffix — see
    /// `undated(_:)`, which strips one before the second lookup.
    static let table: [String: String] = [
        "claude-fable-5": "Fable 5",
        "claude-mythos-5": "Mythos 5",
        "claude-opus-5": "Opus 5",
        "claude-opus-4-8": "Opus 4.8",
        "claude-opus-4-7": "Opus 4.7",
        "claude-opus-4-6": "Opus 4.6",
        "claude-opus-4-5": "Opus 4.5",
        "claude-opus-4-1": "Opus 4.1",
        "claude-opus-4": "Opus 4",
        "claude-3-opus": "Opus 3",
        "claude-sonnet-5": "Sonnet 5",
        "claude-sonnet-4-6": "Sonnet 4.6",
        "claude-sonnet-4-5": "Sonnet 4.5",
        "claude-sonnet-4": "Sonnet 4",
        "claude-3-7-sonnet": "Sonnet 3.7",
        "claude-3-5-sonnet": "Sonnet 3.5",
        "claude-haiku-4-5": "Haiku 4.5",
        "claude-3-5-haiku": "Haiku 3.5",
        "claude-3-haiku": "Haiku 3",
    ]

    /// The CLI's own ALIASES, which no transcript ever spells: `--model` takes one, so a launch
    /// value is written in them (#1175). Read off the composer's own rows rather than typed a
    /// second time — the row already says which model `opus` asks for, and two tables would be two
    /// answers.
    static let aliases: [String: String] = Dictionary(
        uniqueKeysWithValues: RunFactsModel.offered.map { ($0.id, $0.name) },
    )

    /// An id the table knows, said the way a person says it; an id it does not, VERBATIM. The date
    /// suffix a provider pins a snapshot with is dropped before the second lookup, so a dated id of
    /// a model the table DOES know still reads as that model.
    ///
    /// The aliases come after the provider ids and before the undated lookup: an id is what a
    /// record reports, and an alias is only ever what was ASKED for — by Argo on argv, or by a
    /// `/model` the CLI then confirmed (#1411).
    static func readable(_ id: String) -> String {
        table[id] ?? aliases[id] ?? table[undated(id)] ?? id
    }

    /// The id with a provider's pinned-snapshot date taken off the end: `claude-opus-4-1-20250805`
    /// is the same model as `claude-opus-4-1`. Exactly eight digits at the end, after a hyphen —
    /// anything else is part of the name.
    static func undated(_ id: String) -> String {
        guard let separator = id.lastIndex(of: "-") else { return id }
        let tail = id[id.index(after: separator)...]
        guard tail.count == 8, tail.allSatisfy(\.isNumber) else { return id }
        return String(id[id.startIndex ..< separator])
    }
}
