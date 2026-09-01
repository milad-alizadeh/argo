import ArgoEngine

public extension CockpitActions {
    /// What the composer's two pickers list. Both are walked off disk by the app layer — no view
    /// in `ArgoUI` may — and both are `async` because that walk is file-system work whose caller is
    /// the main actor (ADR-0028 Rule 6). Neither answer is cached: that is what puts a file written
    /// mid-Session, or a skill installed mid-Session, in the very next list.
    struct Composer {
        /// Every skill installed for the active Project, read the way the CLI reads them (#685).
        ///
        /// WHEN it is called is the composer's: once per `/` menu opening, never per keystroke
        /// (#961).
        public var skills: () async -> CommandCatalog = { CommandCatalog.empty }
        /// Every file in one folder's Workspace, relative to it (#687) — what the `@` picker lists.
        /// It shells out to git over a tree that can hold a hundred thousand paths, and the
        /// composer must stay typeable while it lists.
        public var workspaceFiles: (String) async -> [String] = { _ in [] }

        public init() {}
    }
}
