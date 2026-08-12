import ArgoEngine

/// What the companion-plugin row is told about itself (#570).
///
/// Three real readings and an honest floor. Argo writes the plugin for every Session it starts
/// (`CompanionPlugin.materialize`), so there is nothing for a user to install — the readings are
/// about whether that write can and did happen, and where even that cannot be established the row
/// reads `unknown`, the registry's own answer for a fact nobody can stand behind. Whether a
/// session's channel is currently live is #493's, not this row's.
public enum ConnectCompanion: Equatable, Sendable {
    /// This build carries the plugin and every spawn writes it.
    case includedWithSpawns
    /// This build ships no plugin, so no spawn has anything to write.
    case missingFromBuild
    /// The last spawn could not write its plugin, in the refusal's own words.
    case installFailed(why: String)
    case unknown

    /// The Hub's fact, degraded down: no channel to ask is `unknown`, never a guess.
    public init(standing: CompanionStanding?) {
        switch standing {
        case .includedWithSpawns: self = .includedWithSpawns
        case .missingFromBuild: self = .missingFromBuild
        case let .installFailed(why): self = .installFailed(why: why)
        case nil: self = .unknown
        }
    }
}
