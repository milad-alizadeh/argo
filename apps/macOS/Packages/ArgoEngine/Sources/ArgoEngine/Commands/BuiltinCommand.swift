/// One of the CLI's own commands, as its Help panel prints it (#686).
///
/// Its own type rather than a `Command` straight away, because what the panel says and what the
/// picker shows are two different questions: everything here was read, and only some of it survives
/// `BuiltinCuration`.
struct BuiltinCommand: Equatable, Sendable, Codable {
    /// Without the leading slash, so it reads the same way a skill's name does.
    let name: String
    /// The CLI's own words, clamped by the panel and kept verbatim including the clamp. `nil` where
    /// the panel printed none.
    let description: String?
}
