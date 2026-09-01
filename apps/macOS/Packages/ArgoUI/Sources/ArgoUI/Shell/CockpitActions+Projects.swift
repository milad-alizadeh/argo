import ArgoEngine

public extension CockpitActions {
    /// Everything the shell raises against a Project (`CONTEXT.md` L1) — the registry of them and
    /// the one this window is pointed at. Every act here is the app layer's: a folder picker, a
    /// Finder call, a registry write.
    ///
    /// Each closure defaults to doing nothing, so a caller names only the acts its surface offers
    /// and `CockpitActions.inert` is an empty one.
    struct Projects {
        /// Re-point the whole cockpit at another registered Project.
        public var select: (String) -> Void = { _ in }
        /// Register a Project — the act that creates one, so it is the app's to run, not the
        /// drawer's.
        public var add: () -> Void = {}
        /// Say where a Project's folder went, keeping the Project it already was.
        public var locate: (String) -> Void = { _ in }
        /// Show a Project's folder in Finder.
        public var reveal: (String) -> Void = { _ in }
        /// Forget a Project — `ProjectRegistry.removing(id:)` is what that means.
        public var remove: (String) -> Void = { _ in }
        /// Open the Connect panel on a Project — or, with `nil`, on none, which is the state that
        /// creates one (ADR-0015).
        public var openPanel: (String?) -> Void = { _ in }

        public init() {}
    }

    /// The two readings the cockpit draws for the Project it is pointed at, and can ask for again:
    /// the checkout off git and the connection to the code host. They sit together because they
    /// are the pair `CockpitPresentation` carries at its own top level, and apart from `Projects`
    /// because neither changes anything — each one only asks for its reading a second time.
    struct Retry {
        /// Read the active Project's checkout again.
        public var checkout: () -> Void = {}
        /// Try the code host once more, after a reading that could not reach it.
        public var connection: () -> Void = {}

        public init() {}
    }
}
