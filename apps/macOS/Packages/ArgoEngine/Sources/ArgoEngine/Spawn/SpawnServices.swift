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
    /// Where the handoff chain is remembered. `nil` remembers nothing, which is the honest default
    /// here for the reason `host` is absent by default: a Hub that cannot spawn cannot hand off,
    /// and a test or a render harness that named no folder must not read or write the machine's own
    /// file.
    public let chainFileURL: URL?

    public init(
        host: AgentProcessHost?,
        launcher: AgentLauncher = AgentLauncher(),
        companionRoot: URL = CompanionChannel.defaultRoot,
        chainFileURL: URL? = nil,
    ) {
        self.host = host
        self.launcher = launcher
        self.companionRoot = companionRoot
        self.chainFileURL = chainFileURL
    }

    /// A Hub that observes and never spawns.
    public static let none = SpawnServices(host: nil)
}
