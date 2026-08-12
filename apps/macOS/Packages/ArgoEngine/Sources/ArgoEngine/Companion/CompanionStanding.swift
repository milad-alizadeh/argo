/// Whether the companion plugin reaches the Sessions this Hub spawns (#570).
///
/// Three readings and no boolean: a Project that gets the plugin with every spawn, a build with
/// nothing to write, and a write that failed are three different sentences on the Connect panel.
/// Whether a session's channel is currently live is deliberately not here — that is #493.
public enum CompanionStanding: Equatable, Sendable {
    /// This build carries the plugin and every spawn writes it. Nothing to install by hand.
    case includedWithSpawns
    /// This build ships no plugin resources, so there is nothing any spawn could write.
    case missingFromBuild
    /// The most recent spawn could not write its plugin, and `why` is the refusal's own words.
    case installFailed(why: String)
}
