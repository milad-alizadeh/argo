import ArgoEngine

/// The companion row's reading (#570): Argo writes the plugin per spawn, so none offers an install.
public enum ConnectCompanion: Equatable, Sendable {
    /// This build carries the plugin and every spawn writes it.
    case includedWithSpawns
    /// This build ships no plugin, so no spawn has anything to write.
    case missingFromBuild
    /// The last spawn could not write its plugin, in the refusal's own words.
    case installFailed(why: String)
    /// The registry's own answer for a fact nobody can stand behind.
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
