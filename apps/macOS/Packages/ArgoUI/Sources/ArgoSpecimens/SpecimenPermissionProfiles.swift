import ArgoEngine

func specimenPermissionProfile(_ harness: AgentCLI) -> SessionPermissionProfile {
    switch harness {
    case .claude:
        SessionPermissionProfile(
            choices: claudePermissionChoices,
            selectedID: "acceptEdits",
            defaultID: "acceptEdits",
        )
    case .codex:
        SessionPermissionProfile(
            choices: codexPermissionChoices,
            selectedID: "approve",
            defaultID: "approve",
        )
    }
}

private let claudePermissionChoices = [
    SessionPermissionProfile.Choice(
        id: "acceptEdits", name: "Allow",
        detail: "Allow edits in the Workspace and ask beyond it", mode: .code,
    ),
    .init(id: "manual", name: "Ask", detail: "Ask before edits or commands", mode: .plan),
    .init(id: "plan", name: "Deny", detail: "Reject changes and stay read only", mode: .readOnly),
    .init(id: "auto", name: "Automode", detail: "Act without approval prompts", mode: .auto),
]

private let codexPermissionChoices = [
    SessionPermissionProfile.Choice(
        id: "ask", name: "Ask for Approval",
        detail: "Ask before edits or leaving the Workspace", mode: .readOnly,
    ),
    .init(
        id: "approve", name: "Approve for Me",
        detail: "Ask only for potentially unsafe actions", mode: .code,
    ),
    .init(
        id: "fullAccess", name: "Full Access",
        detail: "Use the internet and any file without asking", mode: .auto,
    ),
]
