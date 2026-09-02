import ArgoEngine

/// The Connect panel as rows: a folder alone makes a Project, a port says which Account it reads
/// through, an undone Binding says so where it stands, and no honesty tier reaches the screen. The
/// same three rows in both of the panel's lives (`ConnectPanelMode`).
package enum ConnectPanelProjection {
    /// A labelled line: what the row is, what it says, and both spoken. Shared by the folder, the
    /// companion and the Agent rows.
    struct Row: Equatable {
        let title: String
        let detail: String
        let spoken: String
        /// A path, a scope and an identity are machine facts and read as them; a sentence about
        /// what a row buys you is prose.
        let isDetailMachine: Bool
    }

    package struct Panel: Equatable {
        let heading: String
        let folder: Row
        /// The verb on the folder row, which changes with whether there is one.
        let folderCall: String
        package let ports: [PortRow]
        let companion: Row
        /// Absent while creating: a Project that does not exist yet starts no Sessions.
        let agent: Row?
        let challenge: ConnectChallenge?
        let note: ConnectNote?
        let call: String
        let isCallEnabled: Bool
    }

    package static func panel(from reading: ConnectReading) -> Panel {
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
            // provider and the plugin never gate entry (#265).
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

    /// The folder, or the invitation to pick one.
    private static func folderRow(from reading: ConnectReading) -> Row {
        guard let folder = reading.folder else {
            return row(
                title: "Folder",
                detail: "Choose a folder to work in. Git is not required.",
            )
        }
        return row(title: "Folder", detail: folder, isMachine: true)
    }

    private static func companionRow(from reading: ConnectReading) -> Row {
        row(title: "Companion plugin", detail: companionDetail(of: reading.companion))
    }

    /// One sentence per reading (#570): whether the per-spawn plugin write can and did happen.
    private static func companionDetail(of companion: ConnectCompanion) -> String {
        switch companion {
        case .includedWithSpawns:
            "Included with every session Argo starts. There is nothing to install."
        case .missingFromBuild:
            "Not available: this build ships no plugin, so sessions run without one."
        case let .installFailed(why):
            "The last session started without its plugin: \(why)"
        case .unknown:
            "unknown"
        }
    }

    private static func agentRow(of mode: ConnectPanelMode) -> Row? {
        switch mode {
        case .creating: nil
        case let .settings(agent): row(title: "Agent", detail: agent.readableName)
        }
    }
}
