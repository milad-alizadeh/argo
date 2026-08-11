import ArgoEngine

/// The Connect panel as rows, so its promises are values rather than view code: that a folder
/// alone is enough to make a Project, that a port says which Account it reads through, that a
/// Binding which has come undone says so where it stands, and that no honesty tier reaches the
/// screen.
///
/// It draws the same three rows in both of the panel's lives (`ConnectPanelMode`). What settings
/// adds is one row and one word; a second projection for it would be the same rules maintained
/// twice.
enum ConnectPanelProjection {
    /// A labelled line: what the row is, what it currently says, and both of those spoken. Shared
    /// by the folder, the companion and the Agent rows, because the three differ in their words
    /// and in nothing else.
    struct Row: Equatable {
        let title: String
        let detail: String
        let spoken: String
        /// A path, a scope and an identity are machine facts and read as them; a sentence about
        /// what a row buys you is prose. It lives on the row rather than at the call site because
        /// the row already carries every other word it draws, and a flag passed in beside it would
        /// let one caller set a folder in prose and another in the mono.
        let isDetailMachine: Bool
    }

    struct Panel: Equatable {
        let heading: String
        let folder: Row
        /// The verb on the folder row. It changes with whether there is one, because "Change" on
        /// an empty row reads as a folder having failed to appear.
        let folderCall: String
        let ports: [PortRow]
        let companion: Row
        /// The one row onboarding lacks. Absent while creating: a Project that does not exist yet
        /// starts no Sessions, so there is nothing for it to be about.
        let agent: Row?
        let challenge: ConnectChallenge?
        let note: ConnectNote?
        let call: String
        let isCallEnabled: Bool
    }

    static func panel(from reading: ConnectReading) -> Panel {
        Panel(
            heading: heading(of: reading.mode),
            folder: folderRow(from: reading),
            folderCall: reading.folder == nil ? "Choose folder…" : "Change folder…",
            ports: portRows(from: reading),
            companion: companionRow(from: reading),
            agent: agentRow(of: reading.mode),
            challenge: reading.challenge,
            note: reading.note,
            call: call(of: reading.mode),
            // A folder is the only thing that gates the button, and only while creating. Git, a
            // provider and the plugin never do: they unlock what the cockpit can show and never
            // gate entry (#265).
            isCallEnabled: reading.mode != .creating || reading.folder != nil,
        )
    }

    static func row(title: String, detail: String, isMachine: Bool = false) -> Row {
        Row(
            title: title,
            detail: detail,
            spoken: "\(title), \(detail)",
            isDetailMachine: isMachine,
        )
    }

    private static func heading(of mode: ConnectPanelMode) -> String {
        switch mode {
        case .creating: "Set up this project"
        case .settings: "Project settings"
        }
    }

    private static func call(of mode: ConnectPanelMode) -> String {
        switch mode {
        case .creating: "Create project"
        case .settings: "Done"
        }
    }

    /// The folder, or the invitation to pick one. "Git is not required" is said here rather than
    /// discovered: the failure this panel exists to avoid is a setup that refuses to start until
    /// you have a repository and an organisation.
    private static func folderRow(from reading: ConnectReading) -> Row {
        guard let folder = reading.folder else {
            return row(
                title: "Folder",
                detail: "Choose a folder to work in. Git is not required.",
            )
        }
        return row(title: "Folder", detail: folder, isMachine: true)
    }

    /// Argo writes the plugin for every Session it starts, so this row has nothing to ask for. The
    /// state set that would give it more to say is #570's; until that lands, saying more than this
    /// would be inventing it.
    private static func companionRow(from reading: ConnectReading) -> Row {
        switch reading.companion {
        case .includedWithSpawns:
            row(
                title: "Companion plugin",
                detail: "Included with every session Argo starts. There is nothing to install.",
            )
        case .unknown:
            row(title: "Companion plugin", detail: "unknown")
        }
    }

    private static func agentRow(of mode: ConnectPanelMode) -> Row? {
        switch mode {
        case .creating: nil
        case let .settings(agent): row(title: "Agent", detail: agent.readableName)
        }
    }
}
