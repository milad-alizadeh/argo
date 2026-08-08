import Foundation

/// Everything the Hub needs to start an agent of its own, in one value.
///
/// One value rather than three more initialiser parameters, and absent by default: a Hub with no
/// process host cannot spawn, which is the honest state for the render harness and for every test
/// that is about observation. Spawning is a capability the app composes in, not one the engine
/// assumes it has.
@MainActor
public struct SpawnServices {
    public let host: AgentProcessHost?
    public let launcher: AgentLauncher
    /// Where the companion channel writes its sockets and plugin directories.
    public let companionRoot: URL

    public init(
        host: AgentProcessHost?,
        launcher: AgentLauncher = AgentLauncher(),
        companionRoot: URL = CompanionChannel.defaultRoot,
    ) {
        self.host = host
        self.launcher = launcher
        self.companionRoot = companionRoot
    }

    /// A Hub that observes and never spawns.
    public static let none = SpawnServices(host: nil)
}
