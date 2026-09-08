/// Claude Code's permission choices and their exact CLI values.
enum ClaudePermissionControl {
    static let choices = [
        choice("acceptEdits", "Allow", "Allow edits in the Workspace and ask beyond it", .code),
        choice("manual", "Ask", "Ask before edits or commands", .plan),
        choice("plan", "Deny", "Reject changes and stay read only", .readOnly),
        choice("auto", "Automode", "Act without approval prompts", .auto),
    ]

    static func profile(reading: SessionModeReading) -> SessionPermissionProfile {
        profile(selectedID: normalized(reading.cliValue))
    }

    static func profile(mode: SessionMode) -> SessionPermissionProfile {
        profile(selectedID: ClaudePermissionMode.value(for: mode))
    }

    static func choice(id: String) -> SessionPermissionProfile.Choice? {
        choices.first { $0.id == normalized(id) }
    }

    private static func profile(selectedID: String?) -> SessionPermissionProfile {
        SessionPermissionProfile(
            choices: choices,
            selectedID: selectedID,
            defaultID: "acceptEdits",
        )
    }

    private static func choice(
        _ id: String,
        _ name: String,
        _ detail: String,
        _ mode: SessionMode,
    )
        -> SessionPermissionProfile.Choice {
        SessionPermissionProfile.Choice(
            id: id,
            name: name,
            detail: detail,
            mode: mode,
            launchArguments: ["--permission-mode", id],
        )
    }

    static func normalized(_ id: String?) -> String? {
        id == "default" ? "manual" : id
    }
}
