import ArgoEngine
import AtlasLayout
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
    /// What was written about this Project's files, where anybody has written anything (#1159).
    ///
    /// Held beside the reading rather than inside it, because the two are fetched from two files
    /// and only one of them draws the map: a Project with no written layer keeps `.none` here and
    /// draws exactly the map it drew before this existed.
    private(set) var notes: AtlasNotes = .none
    /// How many commits the repository has taken since the drawn Map was measured, or `nil` where
    /// there is a Map to draw but nothing to say about its age — see `commitsBehind(of:project:)`.
    private(set) var behind: Int?
    /// Which Measure drives each channel — the reader's choice where one was made, or the opening
    /// reading for whatever was just measured (#1161).
    private(set) var channels = AtlasChannels("")
    /// Whether test files are left off the map, re-reading the repository without them (#1161).
    private(set) var hideTests = false
    /// Whether the strongest co-change ties are drawn across the whole map (#1160). Not kept past
    /// a reopen, for `isCity`'s reason rather than `hideTests`': hiding test files changes what the
    /// repository IS for the reading, and drawing the ties is a thing laid OVER a reading that is
    /// the same either way.
    private(set) var showTies = false
    /// Whether the map is drawn as the city or as the treemap (#1152). Held here rather than in
    /// the room's view because the control that sets it is in the SIDEBAR and the picture it
    /// changes is in the detail column — two views of one split, neither of which can hold state
    /// the other reads. Not persisted: #1161 keeps the CHANNELS past a reopen, and the room ships
    /// flat every time so the first thing a reader meets is the reading that carries its names.
    private(set) var isCity = false
    private let store: AtlasMapStore
    private let notesStore: AtlasNotesStore
    private let preferences: AtlasChannelPreferences
    /// Which Project the reading is of, so a switch of Project cannot leave the last one's map on
    /// screen (ADR-0015).
    private var readProjectID: String?

    init(
        store: AtlasMapStore = AtlasMapStore(),
        notesStore: AtlasNotesStore = AtlasNotesStore(),
        preferences: AtlasChannelPreferences = AtlasChannelPreferences(),
    ) {
        self.store = store
        self.notesStore = notesStore
        self.preferences = preferences
    }

    /// What the room shows on arriving at a Project: the Map already measured, or the offer to
    /// measure one. Nothing is generated here — a first open that silently walked a repository
    /// would be a room that costs the reader a wait they did not ask for (#1140 story 3).
    func open(_ project: CockpitPresentation.Project?) async {
        guard let project else {
            readProjectID = nil
            reading = .noProject
            notes = .none
            behind = nil
            return
        }
        guard project.id != readProjectID else { return }
        readProjectID = project.id
        hideTests = preferences.hideTests(for: project.id)
        reading = await read(project)
        notes = await written(project, of: reading)
        behind = commitsBehind(project)
        resolveChannels(for: project.id)
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
        // Re-read against the Map that was just measured, never carried over: a rebuild is where
        // a file a note was written about can have changed, which is the whole of what a stale
        // note reports (#1159).
        notes = await written(project, of: reading)
        behind = store.commitsBehind(of: map, project: record)
        // After the reading is written, never before: a regenerated Map can carry Measures the
        // stored choice no longer names, and this reads the channels off what was just measured.
        resolveChannels(for: project.id)
    }

    /// How far the drawn Map is behind the repository it measured, or `nil` where the reading has
    /// no Map to be behind anything (#1162).
    private func commitsBehind(_ project: CockpitPresentation.Project) -> Int? {
        guard case let .measured(map) = reading else { return nil }
        return store.commitsBehind(of: map, project: record(of: project))
    }

    /// Put the reader's channel choice into effect, and keep it past this window closing (#1161).
    /// Nothing here re-tiles: the plan is a pure function of the Map and these channels, recomputed
    /// wherever it is read, so setting the value is the whole of the work.
    func setChannels(_ channels: AtlasChannels) {
        self.channels = channels
        guard let readProjectID else { return }
        preferences.setChannels(channels, for: readProjectID)
    }

    /// Put the reader's filter choice into effect, and keep it past this window closing (#1161).
    func setHideTests(_ hideTests: Bool) {
        self.hideTests = hideTests
        guard let readProjectID else { return }
        preferences.setHideTests(hideTests, for: readProjectID)
    }

    /// Draw the strongest ties across the whole map, or stop (#1160). Nothing is kept: it is a way
    /// of looking at the map rather than a fact about it.
    func setShowTies(_ showTies: Bool) {
        self.showTies = showTies
    }

    /// Step between the city and the treemap (#1152). Nothing is kept: it is a way of looking at
    /// the map rather than a fact about it.
    func setIsCity(_ isCity: Bool) {
        self.isCity = isCity
    }

    /// What was written about the Project, fetched SEPARATELY and after the measurement: the map
    /// is drawn from the Map file alone, and a written layer that is missing, unreadable or from
    /// another tool costs the reader nothing but the sentence it would have carried (#1159).
    ///
    /// The reading is a PARAMETER rather than this container's own property, so both callers read
    /// the same fact the same way: taken off `self`, only the one that had already written the
    /// reading could use it, and the other would spell the fetch a second time.
    private func written(
        _ project: CockpitPresentation.Project,
        of reading: AtlasReading,
    ) async
        -> AtlasNotes {
        guard case let .measured(map) = reading else { return .none }
        return await notesStore.notes(of: record(of: project), in: map)
    }

    private func read(_ project: CockpitPresentation.Project) async -> AtlasReading {
        do {
            guard let map = try await store.map(of: record(of: project)) else { return .unmeasured }
            return .measured(map)
        } catch {
            return .unreadable
        }
    }

    /// Read fresh on every open and every rebuild, never cached across them: a regenerated Map can
    /// carry Measures the stored choice no longer names, and the Measure set is open (#1145).
    private func resolveChannels(for projectID: String) {
        guard case let .measured(map) = reading else { return }
        // `held(over:)` is what makes the sentence above true rather than merely intended: a
        // stored Measure this Map no longer carries falls back per channel, so no menu opens on a
        // selection its own options do not hold.
        channels = preferences.channels(for: projectID)?.held(over: map) ?? .opening(for: map)
    }

    /// The registry's own record for a Project the shell holds. Rebuilt here rather than carried
    /// down: the cockpit restates a Project as its id and where it is, which is all the store
    /// needs to name a file and walk a repository.
    private func record(of project: CockpitPresentation.Project) -> ProjectRecord {
        ProjectRecord(id: project.id, path: project.location)
    }
}
