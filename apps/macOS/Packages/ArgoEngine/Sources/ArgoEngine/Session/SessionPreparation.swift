/// The editable choices before the first Send starts a Session.
public struct SessionPreparation: Equatable, Sendable {
    public var cwd: String?
    public let harness: AgentCLI
    public let catalog: SessionRunCatalog
    public var run: SessionRun
    public var permission: SessionPermissionProfile

    public var mode: SessionMode {
        permission.selected?.mode ?? .code
    }

    public init(
        harness: AgentCLI,
        catalog: SessionRunCatalog,
        run: SessionRun,
        permission: SessionPermissionProfile,
    ) {
        self.harness = harness
        self.catalog = catalog
        self.run = run
        self.permission = permission
    }
}
