import ArgoEngine

package extension SessionComposerProjection {
    /// What the Session's adapter declares about itself. One type rather than parallel flags
    /// because they travel together from `CockpitView` down to the vessel, and each is read off the
    /// drive port for the same Session at the same moment.
    struct Capabilities: Equatable {
        var canAttach = false
        var canRunCommands = false
        var resolvesMentions = false
        var chooses = RunFactKnobs()
        var catalog: SessionRunCatalog?
        var permission: SessionPermissionProfile?

        /// Spelled out because the specimens build this from their own target.
        package init(
            canAttach: Bool = false,
            canRunCommands: Bool = false,
            resolvesMentions: Bool = false,
            chooses: RunFactKnobs = RunFactKnobs(),
        ) {
            self.canAttach = canAttach
            self.canRunCommands = canRunCommands
            self.resolvesMentions = resolvesMentions
            self.chooses = chooses
        }
    }
}
