/// Which of the CLI's built-ins the composer's `/` picker offers (#686).
///
/// The only hand-maintained part of the feature, and it fails SOFT on purpose: what it names is
/// what to leave OUT, so a command it has never heard of is shown un-curated rather than hidden.
enum BuiltinCuration {
    /// The read list, minus the vetoes, in the order the panel gave it.
    static func keeps(_ read: [BuiltinCommand]) -> [BuiltinCommand] {
        read.filter { !vetoed.contains($0.name) }
    }

    /// The three rules of `cockpit-composer-picker.md`, as the #589 grill's per-command table
    /// settled them. **R1** — the command is about the terminal, not the Session. **R2** — Argo
    /// already draws the surface, so the CLI's own version of it would land somewhere the cockpit
    /// does not draw. Everything not named here is R3: a prompt, or an act on the Session's state.
    ///
    /// A pure-data catalog, which is the one file shape `code-style.md` exempts from the ceiling.
    private static let vetoed: Set<String> = [
        // R1 — terminal chrome, TUI-only panels and dialogs, and interactive setup wizards.
        "agents", "artifacts", "background", "bug", "chrome", "color", "config", "debug",
        "design", "design-login", "desktop", "exit", "feedback", "focus", "help", "hooks",
        "ide", "import", "install-github-app", "install-slack-app", "keybindings", "login",
        "logout", "mobile", "plugin", "powerup", "radio", "release-notes", "remote-control",
        "remote-env", "rewind", "sandbox", "scroll-speed", "skills", "statusline", "stickers",
        "teleport", "terminal-setup", "theme", "tui", "upgrade", "usage-credits", "voice",
        "workflows",
        // R2 — Argo owns the surface: resume (ADR-0026), Usage, Permission, Delivery diffs, the
        // roster, the feed record, and Model/Effort (#558).
        "context", "copy", "diff", "effort", "export", "fast", "fork", "list-agents", "mcp",
        "model", "permissions", "resume", "status", "tasks", "usage",
    ]
}
