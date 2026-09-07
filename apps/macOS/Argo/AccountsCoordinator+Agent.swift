import ArgoEngine

@MainActor
extension AccountsCoordinator {
    func chooseAgent(_ agent: AgentCLI) async {
        guard let projectID = project?.id else { return }
        let changed = await projects.chooseAgent(agent, for: projectID)
        guard project?.id == projectID, let record = changed.project else { return }
        project = record
        mode = .settings(agent: record.agent)
        await refresh()
    }
}
