import Foundation

/// What version of the CLI is installed, asked of the CLI itself. A closure for `ShellCommand`'s
/// reason: what the string MEANS is nobody's business here, and a test needs to answer for it.
typealias AgentVersionReading = @MainActor (URL) async -> String?

/// Keeps the CLI's own built-in commands, reading them once per version of it (#686).
///
/// Held for the life of the window and asked at launch, never when the picker opens — the read
/// costs a hidden session and the seconds a TUI spends drawing itself, and a menu that waited on
/// that would be a menu nobody uses. Until it answers, the picker draws its skills and says the
/// other half is coming.
@MainActor
public final class BuiltinCommandReader {
    /// Where the answer is kept between launches. `nil` keeps nothing, which is what a render
    /// harness passes — `OwnedStateFile`'s rule.
    public static let defaultFileURL: URL? = BuiltinCommandStore.defaultFileURL

    private let store: BuiltinCommandStore
    private let session: HelpPanelSession
    private let version: AgentVersionReading
    /// The read in flight, so a second `read(inProjectAt:)` joins it rather than starting a second
    /// hidden `claude` beside the first.
    private var inFlight: Task<Void, Never>?

    private var commands: [Command] = []
    private var status: BuiltinStatus = .reading

    /// What the app composes: a real hidden session, a real terminal to paint it on, and the file
    /// the answer is kept in.
    public convenience init(
        host: AgentProcessHost,
        screen: TerminalScreen,
        launcher: AgentLauncher = AgentLauncher(),
        fileURL: URL? = BuiltinCommandReader.defaultFileURL,
    ) {
        let version = AgentVersion(launcher: launcher, run: shellCommand)
        self.init(
            store: BuiltinCommandStore(fileURL: fileURL),
            session: HelpPanelSession(host: host, launcher: launcher, screen: screen),
            version: { await version.reported(by: .claude, inProjectAt: $0) },
        )
    }

    init(
        store: BuiltinCommandStore,
        session: HelpPanelSession,
        version: @escaping AgentVersionReading,
    ) {
        self.store = store
        self.session = session
        self.version = version
    }

    /// Ask, unless the answer is already known. Returns as soon as the work is under way: the
    /// caller is a window opening, not something waiting on a list.
    public func read(inProjectAt projectURL: URL) {
        guard inFlight == nil else { return }
        inFlight = Task { [weak self] in await self?.reading(inProjectAt: projectURL) }
    }

    /// The picker's whole catalog: the skills the caller just read, plus whatever this has, plus
    /// how the asking is going.
    ///
    /// Called on every open, so a skill installed a moment ago is in the list — while the built-in
    /// half stays exactly as it was, because it is keyed to a version rather than to a moment.
    public func catalog(joining skills: [Command]) -> CommandCatalog {
        CommandCatalog(
            commands: CommandCatalog.joined(skills: skills, builtins: commands),
            builtins: status,
        )
    }

    private func reading(inProjectAt projectURL: URL) async {
        let reported = await version(projectURL)
        if let kept = store.commands(reportedBy: reported) {
            return settle(on: kept)
        }
        guard let read = try? await panel(inProjectAt: projectURL) else {
            status = .unavailable
            return
        }
        store.remember(read, reportedBy: reported)
        settle(on: read)
    }

    /// Curated on the way OUT of the store rather than on the way in, so what is kept stays the
    /// CLI's own answer: changing which commands Argo shows must not need everyone's kept file
    /// thrown away to take effect.
    private func settle(on read: [BuiltinCommand]) {
        commands = BuiltinCuration.keeps(read).map {
            Command(name: $0.name, description: $0.description, origin: .claudeCode)
        }
        status = .read
    }

    private func panel(inProjectAt projectURL: URL) async throws -> [BuiltinCommand] {
        try await HelpPanel.commands(on: session.rows(inProjectAt: projectURL))
    }
}
