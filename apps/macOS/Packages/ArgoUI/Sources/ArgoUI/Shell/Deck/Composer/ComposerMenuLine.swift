/// Everything about the draft and the Session that decides which composer menu opens, and nothing
/// about how one is drawn (#752).
///
/// A value the view assembles per render, so `ComposerMenus` never reads a projection: the menus
/// answer over a line, and a test states one in four lines.
struct ComposerMenuLine: Equatable {
    var text = ""
    /// `false` for an adapter that declares no command surface — a `codex` Session gets no `/` menu
    /// at all (design decision 14).
    var canRunCommands = false
    /// `nil` where there is no Workspace to name a file in, which withholds the `@` menu rather
    /// than drawing an empty one.
    var workspaceRoot: String?
    /// The paths the agent has already been in, newest first — they sort to the top of the `@`
    /// menu.
    var touchedFiles: [String] = []
}

extension ComposerMenuLine {
    /// The line as the composer's own projection states it, so the view names none of these fields
    /// and a change to what opens a menu is one edit here. In an EXTENSION, which is what keeps the
    /// memberwise initializer a test states a line with.
    init(_ text: String, on composer: SessionComposerProjection.Composer) {
        self.init(
            text: text,
            canRunCommands: composer.canRunCommands,
            workspaceRoot: composer.workspaceRoot,
            touchedFiles: composer.touchedFiles,
        )
    }
}
