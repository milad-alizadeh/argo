import ArgoEngine
import Foundation
import Observation

/// The thin container behind the Atlas room: it holds the store, and the room takes its value.
///
/// A container rather than a projection because the Map is not a Hub fact and nothing pushes it —
/// it is read from a file on this machine and written when the reader asks. The store is an actor,
/// so every path it opens and every process it spawns is off the main actor (ADR-0028 rule 6);
/// what stays here is the reading it answered.
@MainActor
@Observable
final class AtlasRoomModel {
    private(set) var reading: AtlasReading = .noProject
    /// How many commits the repository has taken since the drawn Map was measured, or `nil` where
    /// there is a Map to draw but nothing to say about its age — see `commitsBehind(of:project:)`.
    private(set) var behind: Int?
    private let store: AtlasMapStore
    /// Which Project the reading is of, so a switch of Project cannot leave the last one's map on
    /// screen (ADR-0015).
    private var readProjectID: String?

    init(store: AtlasMapStore = AtlasMapStore()) {
        self.store = store
    }

    /// What the room shows on arriving at a Project: the Map already measured, or the offer to
    /// measure one. Nothing is generated here — a first open that silently walked a repository
    /// would be a room that costs the reader a wait they did not ask for (#1140 story 3).
    func open(_ project: CockpitPresentation.Project?) async {
        guard let project else {
            readProjectID = nil
            reading = .noProject
            behind = nil
            return
        }
        guard project.id != readProjectID else { return }
        readProjectID = project.id
        reading = await read(project)
        behind = commitsBehind(project)
    }

    /// Measure the repository and write the Map, on the reader's own gesture.
    func rebuild(_ project: CockpitPresentation.Project?) async {
        guard let project else { return }
        readProjectID = project.id
        reading = .measuring
        behind = nil
        let record = record(of: project)
        let map = await store.generate(for: record)
        reading = .measured(map)
        behind = store.commitsBehind(of: map, project: record)
    }

    /// How far the drawn Map is behind the repository it measured, or `nil` where the reading has
    /// no Map to be behind anything (#1162).
    private func commitsBehind(_ project: CockpitPresentation.Project) -> Int? {
        guard case let .measured(map) = reading else { return nil }
        return store.commitsBehind(of: map, project: record(of: project))
    }

    private func read(_ project: CockpitPresentation.Project) async -> AtlasReading {
        do {
            guard let map = try await store.map(of: record(of: project)) else { return .unmeasured }
            return .measured(map)
        } catch {
            return .unreadable
        }
    }

    /// The registry's own record for a Project the shell holds. Rebuilt here rather than carried
    /// down: the cockpit restates a Project as its id and where it is, which is all the store
    /// needs to name a file and walk a repository.
    private func record(of project: CockpitPresentation.Project) -> ProjectRecord {
        ProjectRecord(id: project.id, path: project.location)
    }
}
