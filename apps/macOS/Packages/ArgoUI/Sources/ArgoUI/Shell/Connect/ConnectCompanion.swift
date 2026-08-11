/// What the companion-plugin row is told about itself.
///
/// Deliberately two cases and no vocabulary of its own: the row's full state set belongs to #570,
/// and until that lands the panel may only say what is already true. Argo writes the plugin for
/// every Session it starts (`CompanionPlugin.materialize`), so there is nothing for a user to
/// install and no word to invent — and where even that cannot be established the row reads
/// `unknown`, which is the registry's own answer for a fact nobody can stand behind.
public enum ConnectCompanion: Equatable, Sendable {
    case includedWithSpawns
    case unknown
}
