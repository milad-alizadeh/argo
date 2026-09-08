/// The editable choices before the first Send starts a Session.
public struct SessionPreparation: Equatable, Sendable {
    public var cwd: String?
    public let harness: AgentCLI
    public let catalog: SessionRunCatalog
    public var run: SessionRun
    public var mode: SessionMode

    public var modeReading: SessionModeReading {
        .exactly(mode, cli: ClaudePermissionMode.value(for: mode))
    }

    public init(harness: AgentCLI, catalog: SessionRunCatalog, run: SessionRun, mode: SessionMode) {
        self.harness = harness
        self.catalog = catalog
        self.run = run
        self.mode = mode
    }
}
