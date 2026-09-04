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
            return
        }
        guard project.id != readProjectID else { return }
        readProjectID = project.id
        reading = await read(project)
    }

    /// Measure the repository and write the Map, on the reader's own gesture.
    func rebuild(_ project: CockpitPresentation.Project?) async {
        guard let project else { return }
        readProjectID = project.id
        reading = .measuring
        reading = await .measured(store.generate(for: record(of: project)))
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
