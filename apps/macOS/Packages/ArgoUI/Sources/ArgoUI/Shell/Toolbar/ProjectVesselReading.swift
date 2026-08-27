/// What the toolbar's Project half draws: its mark, the name it spells out, and the two sentences
/// it says about the active Project.
struct ProjectVesselReading: Equatable {
    /// What the press does. One sentence for the one gesture, whatever the Project's state.
    static let hint = "Opens the Project drawer"

    let mark: String
    /// Spelled out rather than initialled, and named even when there is none to name.
    let name: String
    let help: String
    /// State is spoken, never left to the mark.
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
                // What the VESSEL is for. `NewSessionOffer` refuses the same machine in its own
                // words, because a disabled spawn is a different question.
                help: "No Project registered — add one to scope this window",
                announcement: "Project, none registered",
            )
            return
        }
        guard project.isReachable else {
            self.init(
                mark: ArgoSymbol.unreachableProject,
                name: project.name,
                help: "Project — \(project.name) · \(ProjectDrawerProjection.unreachable)",
                announcement: "Project, \(project.name), \(ProjectDrawerProjection.unreachable)",
            )
            return
        }
        self.init(
            mark: ArgoSymbol.project,
            name: project.name,
            help: "Project — \(project.name) · \(project.location)",
            announcement: "Project, \(project.name)",
        )
    }
}
