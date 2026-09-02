/// Whether a missing folder has disabled this window, and everything the one error state says.
///
/// The folder IS the Project — ADR-0015 makes it the scope and #165 the floor — so a folder that is
/// not at the recorded path disables the Project WHOLE (failure spec §6). Not a room's state and
/// not a per-room split: a per-room degradation was proposed and rejected, because a Project you
/// cannot act in does not earn a half-lit window.
///
/// `nil` is the ordinary window. A value is the whole of what replaces it, which is why the
/// decision lives here rather than in a `body` no suite can read.
struct ProjectDisabledReading: Equatable {
    /// What both repair verbs are sent with. The id survives a relocation; the path does not.
    let projectID: String
    let name: String
    /// `folder not found` — the registered status word for Project integrity
    /// (`cockpit-status-vocabulary.md`), never a second wording of it here.
    let state: String
    /// What is wrong, why the window is dark, and what to do, in that order.
    let detail: String
}

extension ProjectDisabledReading {
    init?(presentation: CockpitPresentation) {
        self.init(project: presentation.activeProject)
    }

    /// The ACTIVE Project only. A window is scoped to one Project, so another registered folder
    /// going missing is a menu row's state (`ProjectMenuProjection`) and not this window's.
    ///
    /// An unregistered launch target is left alone whatever its folder is doing: there is no record
    /// to re-point or to forget, so neither verb this state exists to offer would do anything.
    init?(project: CockpitPresentation.Project?) {
        guard let project, project.isRegistered, !project.isReachable else { return nil }
        self.init(
            projectID: project.id,
            name: project.name,
            state: ProjectMenuProjection.unreachable,
            detail: "Argo has no folder at \(project.location). "
                + "This Project is disabled until you say where the folder went, or remove it.",
        )
    }
}
