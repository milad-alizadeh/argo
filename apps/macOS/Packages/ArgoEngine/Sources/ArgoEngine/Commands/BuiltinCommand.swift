/// One of the CLI's own commands, as its Help panel prints it (#686) — everything that was read,
/// before `BuiltinCuration` decides which of it the picker shows.
struct BuiltinCommand: Equatable, Sendable, Codable {
    /// Without the leading slash, so it reads the same way a skill's name does.
    let name: String
    /// The CLI's own words, clamped by the panel and kept verbatim including the clamp. `nil` where
    /// the panel printed none.
    let description: String?
}
