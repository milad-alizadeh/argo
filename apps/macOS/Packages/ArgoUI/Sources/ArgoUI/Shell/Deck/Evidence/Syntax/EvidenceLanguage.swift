/// What a file is written in, read from its own name.
///
/// The extension and nothing else — the contents are never sniffed. An unrecognised extension is
/// `nil` here and renders as plain text under the generic mark.
///
/// The `alias` is highlight.js's own name for the grammar, handed straight to it.
enum EvidenceLanguage: String, CaseIterable, Sendable {
    case swift
    case typescript
    case javascript
    /// `go` is under the house style's identifier floor; `alias` is what highlight.js is handed.
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
    /// Both the language's own name and the extension people write instead (```` ```ts ````,
    /// ```` ```bash ````) resolve; a word Argo does not know is `nil` and the block is drawn as
    /// it arrived.
    init?(declared: String) {
        let word = declared.trimmingCharacters(in: .whitespaces).lowercased()
        guard let language = Self(rawValue: word) ?? Self.byExtension[word] else { return nil }
        self = language
    }

    /// highlight.js's own alias for the grammar.
    var alias: String {
        self == .golang ? "go" : rawValue
    }

    /// One mark per language FAMILY: SF Symbols carries a trademarked glyph for exactly one of
    /// these, and the extension in the path beside it is what actually names the language.
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
