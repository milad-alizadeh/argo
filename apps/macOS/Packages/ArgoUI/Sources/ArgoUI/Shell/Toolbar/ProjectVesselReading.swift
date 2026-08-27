/// What the toolbar's Project half draws: its mark, the name it spells out, and the two sentences
/// it says about the active Project.
///
/// A reading rather than derivations on the `View`, for the reason `ProjectDrawerProjection` gives
/// one control over — nothing renders a view on CI, so an accessibility claim held in a `private
/// var` on a `View` is a claim nothing can ever check. The unreachable words are the drawer's, not
/// a second copy of them.
struct ProjectVesselReading: Equatable {
    let mark: String
    /// Spelled out rather than initialled, and named even when there is none to name.
    let name: String
    let help: String
    /// State is spoken, never left to the mark: unreachability is a word here and in the drawer.
    let announcement: String
}

extension ProjectVesselReading {
    init(presentation: CockpitPresentation) {
        self.init(project: presentation.activeProject)
    }

    init(project: CockpitPresentation.Project?) {
        guard let project else {
            self.init(
                mark: ArgoSymbol.project,
                name: "No Project",
                // What the VESSEL is for — the window's scope. `NewSessionOffer` refuses the same
                // machine in its own words, because a disabled spawn is a different question.
                help: "No Project registered — add one to scope this window",
                announcement: "Project, none registered",
            )
            return
        }
        self.init(
            // A Project whose folder is gone says so with its mark as well as in words.
            mark: project.isReachable ? ArgoSymbol.project : ArgoSymbol.unreachableProject,
            name: project.name,
            help: "Project — \(project.name) · \(Self.place(project))",
            announcement: project.isReachable
                ? "Project, \(project.name)"
                : "Project, \(project.name), \(ProjectDrawerProjection.unreachable)",
        )
    }

    private static func place(_ project: CockpitPresentation.Project) -> String {
        project.isReachable ? project.location : ProjectDrawerProjection.unreachable
    }
}
