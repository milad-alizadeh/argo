/// The two verbs that repair a Project whose folder is not where it was registered, and the words
/// they are offered in.
///
/// One type because there is ONE repair (failure spec §6), reached from more than one place: the
/// disabled window offers both verbs, the Project menu re-points a row whose folder has gone, and
/// the Manage submenu forgets a Project. Two spellings of `Remove from Argo` is how one of them
/// ends up promising to delete the folder.
///
/// Relocate is first-class rather than a workaround: a Project is keyed to a stable id and the path
/// is a mutable attribute (`CONTEXT.md` L1), so re-pointing it keeps the Project it already was and
/// everything linked to that id comes with it.
package struct ProjectRepair {
    /// The ellipsis is the platform's promise that a folder picker follows.
    static let relocate = "Relocate…"
    /// Not `Remove project`: what goes is Argo's registration, and the label says which.
    static let remove = "Remove from Argo"
    static let removeHelp = "Removes Argo's registration only. The folder on disk is not touched."
    /// Every word this type puts on screen. Read by the copy sweep in `ProjectRepairTests`, which
    /// holds the verbs to spending no status word.
    static let all = [relocate, remove, removeHelp]

    /// The Project both verbs act on. Carried rather than read from the presentation, so the id the
    /// error state names is the id the act is sent with.
    let projectID: String
    let actions: CockpitActions

    /// Say where the folder went. The app raises the picker; nothing here knows what a folder is.
    func locate() {
        actions.projects.locate(projectID)
    }

    /// Forget the Project. `ProjectRegistry.removing(id:)` is the whole of what that means.
    func forget() {
        actions.projects.remove(projectID)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(projectID: String, actions: CockpitActions) {
        self.projectID = projectID
        self.actions = actions
    }
}
