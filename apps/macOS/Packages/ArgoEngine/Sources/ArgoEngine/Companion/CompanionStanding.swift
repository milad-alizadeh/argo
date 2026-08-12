/// Whether the companion plugin reaches the Sessions this Hub spawns (#570); liveness is #493's.
public enum CompanionStanding: Equatable, Sendable {
    /// This build carries the plugin and every spawn writes it. Nothing to install by hand.
    case includedWithSpawns
    /// This build ships no plugin resources, so no spawn has anything to write.
    case missingFromBuild
    /// The most recent spawn could not write its plugin; `why` is the refusal's own words.
    case installFailed(why: String)
}
