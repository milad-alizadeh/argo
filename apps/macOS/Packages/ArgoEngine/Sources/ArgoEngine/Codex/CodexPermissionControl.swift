/// Codex's approval presets and the stance each sends with the next Turn.
enum CodexPermissionControl {
    static let choices = [
        SessionPermissionProfile.Choice(
            id: "ask",
            name: "Ask for Approval",
            detail: "Ask before edits, internet access, or leaving the Workspace",
            mode: .readOnly,
        ),
        SessionPermissionProfile.Choice(
            id: "approve",
            name: "Approve for Me",
            detail: "Ask only for actions detected as potentially unsafe",
            mode: .code,
        ),
        SessionPermissionProfile.Choice(
            id: "fullAccess",
            name: "Full Access",
            detail: "Use the internet and any file without asking",
            mode: .auto,
        ),
    ]

    static func profile(mode: SessionMode) -> SessionPermissionProfile {
        SessionPermissionProfile(
            choices: choices,
            selectedID: choices.first { $0.mode == mode }?.id,
            defaultID: "approve",
        )
    }

    static func choice(id: String) -> SessionPermissionProfile.Choice? {
        choices.first { $0.id == id }
    }
}
