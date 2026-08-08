/// What a file is written in, read from its own name.
///
/// The extension and nothing else. A transcript records a path, not a language, and sniffing the
/// contents to guess would be Argo asserting something the record never said — an unrecognised
/// extension is `nil` here and renders as plain text under the generic mark, which is the honest
/// answer and also the harmless one.
///
/// The `alias` is highlight.js's own name for the grammar, handed straight to it. Argo does not
/// keep a grammar of its own — that is the dependency's whole job.
enum EvidenceLanguage: String, CaseIterable, Sendable {
    case swift
    case typescript
    case javascript
    /// Named for the language and not for its two-letter extension: `go` is under the identifier
    /// floor the house style sets, and the alias below is what highlight.js is actually handed.
    case golang
    case python
    case ruby
    case rust
    case shell
    case json
    case yaml
    case markdown
    case html
    case css
    case sql

    /// `nil` where the name carries no extension Argo recognises.
    init?(path: String) {
        guard let name = path.split(separator: "/").last,
              let suffix = name.split(separator: ".").last,
              name.contains("."),
              let language = Self.byExtension[String(suffix).lowercased()]
        else { return nil }
        self = language
    }

    /// The language an agent DECLARED, from the info string on a fenced block.
    ///
    /// A different source from the path above and a better one: the agent wrote the word, so
    /// colouring by it is reading the record rather than sniffing it. Both the language's own
    /// name and the extension people write instead (```` ```ts ````, ```` ```bash ````) resolve;
    /// a word Argo does not know is `nil` and the block is drawn as it arrived.
    init?(declared: String) {
        let word = declared.trimmingCharacters(in: .whitespaces).lowercased()
        guard let language = Self(rawValue: word) ?? Self.byExtension[word] else { return nil }
        self = language
    }

    /// highlight.js's own alias for the grammar.
    var alias: String {
        self == .golang ? "go" : rawValue
    }

    /// One mark per language FAMILY rather than per language, because SF Symbols carries a
    /// trademarked glyph for exactly one of these and inventing the rest as near-identical
    /// documents would be a column of marks nobody can tell apart. The extension is still in the
    /// path beside it, which is what actually names the language.
    var symbol: String {
        switch self {
        case .swift: ArgoSymbol.swiftSource
        case .typescript, .javascript, .golang, .python, .ruby, .rust, .sql, .html, .css:
            ArgoSymbol.programSource
        case .json, .yaml: ArgoSymbol.dataSource
        case .markdown: ArgoSymbol.proseSource
        case .shell: ArgoSymbol.ran
        }
    }

    private static let byExtension: [String: EvidenceLanguage] = [
        "swift": .swift,
        "ts": .typescript, "tsx": .typescript, "mts": .typescript, "cts": .typescript,
        "js": .javascript, "jsx": .javascript, "mjs": .javascript, "cjs": .javascript,
        "go": .golang,
        "py": .python,
        "rb": .ruby,
        "rs": .rust,
        "sh": .shell, "bash": .shell, "zsh": .shell, "fish": .shell,
        "json": .json, "jsonc": .json,
        "yml": .yaml, "yaml": .yaml,
        "md": .markdown, "mdx": .markdown, "markdown": .markdown,
        "html": .html, "htm": .html,
        "css": .css, "scss": .css,
        "sql": .sql,
    ]
}
