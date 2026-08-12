import Foundation

/// Where one cockpit window points: the registered set, the mark on screen, and what this launch
/// was pointed with. Every act on the strip moves this and nothing else.
public struct CockpitPointing: Equatable, Sendable {
    public let registry: ProjectRegistry
    public let launch: LaunchProject
    /// Kept for the window's life rather than only while it is active: switching away from an
    /// unregistered launch target must be reversible without a relaunch.
    public let launchOrigin: LaunchProject?

    public init(
        registry: ProjectRegistry,
        launch: LaunchProject,
        launchOrigin: LaunchProject?,
    ) {
        self.registry = registry
        self.launch = launch
        self.launchOrigin = launchOrigin
    }

    /// What one act does to the window. No act writes: each carries the registry a store already
    /// answered with, and `Move.activates` names the one write this value asks for.
    public enum Act: Equatable, Sendable {
        /// The registry was read and `LaunchProject.resolve` answered where this launch opens.
        case launched(LaunchProject, reading: ProjectRegistry)
        /// A mark on the strip was chosen, under the id the strip draws it with.
        case selected(id: String)
        /// A folder was registered or relocated: the store's record, absent where it refused, and
        /// the registry it left.
        case landed(on: ProjectRecord?, leaving: ProjectRegistry)
        /// A Project was forgotten: the record that went, and the registry without it.
        case removed(ProjectRecord, leaving: ProjectRegistry)
    }

    /// What the Hub is told, which is not the same as where the window points: an act that lands
    /// nowhere leaves the Hub alone, and forgetting the last Project lets it go entirely.
    public enum HubTarget: Equatable, Sendable {
        /// A `--transcript` is an override for the folder it was named with, so it travels only
        /// while the Hub is still on that folder.
        case connect(url: URL, carryingLaunchTranscripts: Bool)
        case disconnect
        case unchanged
    }

    public struct Move: Equatable, Sendable {
        public let pointing: CockpitPointing
        /// The Project the registry must be told is active, and `nil` where this act leaves the
        /// registry alone.
        public let activates: String?
        public let hub: HubTarget
    }

    public func moved(by act: Act) -> Move {
        switch act {
        case let .launched(origin, registry):
            // Through a pointing that already holds the origin: it is what decides whether the
            // named transcripts travel, and on the launch itself they always do.
            CockpitPointing(registry: registry, launch: origin, launchOrigin: origin)
                .pointing(at: origin, in: registry)
        case let .selected(id):
            selecting(id: id)
        case let .landed(record, registry):
            landing(on: record, leaving: registry)
        case let .removed(record, registry):
            removing(record, leaving: registry)
        }
    }

    /// The same pointing over a registry read since. The store's answer wins over the one derived
    /// here: another window may have registered a Project between the decision and the write.
    public func reading(_ registry: ProjectRegistry) -> CockpitPointing {
        CockpitPointing(registry: registry, launch: launch, launchOrigin: launchOrigin)
    }

    /// A registered mark activates and re-points; the launch target re-points and registers
    /// nothing; anything else — the mark already on screen, or an id from a stale action closure —
    /// moves nothing at all.
    private func selecting(id: String) -> Move {
        guard id != launch.id else { return staying(in: registry) }
        if let record = registry.project(id: id) {
            return pointing(at: .registered(record), in: registry, activating: record.id)
        }
        guard let origin = launchOrigin, origin.id == id else { return staying(in: registry) }
        return pointing(at: origin, in: registry)
    }

    /// A refused registration or relocation answers no record, and the registry it left still has
    /// to be held: the window stays where it is rather than going stale.
    private func landing(on record: ProjectRecord?, leaving registry: ProjectRegistry) -> Move {
        guard let record else { return staying(in: registry) }
        return pointing(at: .registered(record), in: registry, activating: record.id)
    }

    /// Removing the mark on screen lands on the registry's new active record. Removing the LAST
    /// one leaves an unregistered pointer at that folder with the Hub let go: there is nothing
    /// left to read, and the folder is the only name the window still has.
    private func removing(_ record: ProjectRecord, leaving registry: ProjectRegistry) -> Move {
        guard record.id == launch.id else { return staying(in: registry) }
        guard let landing = registry.active else {
            return Move(
                pointing: reading(registry).pointed(at: .unregistered(record.url)),
                activates: nil,
                hub: .disconnect,
            )
        }
        return pointing(at: .registered(landing), in: registry)
    }

    private func pointing(
        at project: LaunchProject,
        in registry: ProjectRegistry,
        activating id: String? = nil,
    )
        -> Move {
        Move(
            pointing: reading(id.map(registry.activating(id:)) ?? registry)
                .pointed(at: project),
            activates: id,
            hub: .connect(
                url: project.url,
                carryingLaunchTranscripts: project.url == launchOrigin?.url,
            ),
        )
    }

    private func staying(in registry: ProjectRegistry) -> Move {
        Move(pointing: reading(registry), activates: nil, hub: .unchanged)
    }

    private func pointed(at project: LaunchProject) -> CockpitPointing {
        CockpitPointing(registry: registry, launch: project, launchOrigin: launchOrigin)
    }
}
