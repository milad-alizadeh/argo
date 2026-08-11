import ArgoEngine
import ArgoUI
import Foundation
import Observation

/// What the Connect panel is looking at: the Accounts this Mac holds, what each of the active
/// Project's ports reads through, and whatever is in flight.
///
/// Separate from `CockpitCoordinator` because the two own different registries and answer to
/// different acts. The cockpit owns Projects and points the Hub; this owns Accounts and Bindings,
/// neither of which the Hub has ever heard of. The one thing they share is which Project is
/// active, and it travels in as a value.
@MainActor
@Observable
final class AccountsCoordinator {
    /// The panel's whole input, and `nil` while it is closed. One field for both, so "open" and
    /// "has something to draw" cannot disagree.
    private(set) var reading: ConnectReading?
    private(set) var startsAtWelcome = false

    private let accounts: AccountRegistryStore
    private let bindings: ProjectBindings
    /// Reached from `AccountsCoordinator+Grant`, which is why these three are not `private`:
    /// `private` in Swift is file-scoped, and the grant sequence is its own file because it is its
    /// own subject.
    let authorization: GitHubAuthorization

    /// Whether the panel is meant to be up. Kept apart from `reading` because every act ends in a
    /// rebuild, and a rebuild that decided for itself would re-open a panel the user just closed.
    private var isOpen = false
    private var project: ProjectRecord?
    private var mode: ConnectPanelMode = .creating
    var challenge: ConnectChallenge?
    private var note: ConnectNote?
    /// The wait on a grant, held so it can be stopped and so a second `Connect` cannot leave two
    /// polls running against one panel.
    var grant: Task<Void, Never>?

    init(projects: ProjectRegistryStore) {
        let store = AccountRegistryStore(bindings: ProjectBindingIndex(projects: projects))
        self.accounts = store
        self.bindings = ProjectBindings(projects: projects, accounts: store)
        self.authorization = GitHubAuthorization(accounts: store)
    }

    /// Open the panel on a Project, or on none: onboarding IS creating a Project (ADR-0015), so
    /// the panel with no Project is not an error state — it is the state that produces one.
    func open(
        on project: ProjectRecord?,
        mode: ConnectPanelMode = .creating,
        welcoming: Bool = false,
    ) async {
        self.project = project
        self.mode = mode
        startsAtWelcome = welcoming
        note = nil
        isOpen = true
        await refresh()
    }

    /// Whether a machine that has never registered anything should be met by the panel. Asked of
    /// the registry rather than remembered in a flag: a first launch is a machine with no Project,
    /// and a flag would have to be kept true by something.
    func openIfUnstarted(registry: ProjectRegistry) async {
        guard registry.projects.isEmpty else { return }
        await open(on: nil, welcoming: true)
    }

    func close() {
        stopWaiting()
        isOpen = false
        reading = nil
        startsAtWelcome = false
        note = nil
    }

    /// The folder was chosen and the Project registered, so the panel now has something to bind
    /// against. Registering on the pick rather than on `Create project` is what ADR-0015 means:
    /// the folder IS the Project, and the button below it only closes the panel.
    func pointed(at project: ProjectRecord?) async {
        guard isOpen else { return }
        self.project = project
        await refresh()
    }

    func bind(port: AccountPort, accountID: String, scope: String) async {
        guard let project else {
            return await report(ConnectNote(refusal: .noSuchProject))
        }
        do {
            try await bindings.bind(
                ProjectBinding(port: port, accountID: accountID, scope: scope),
                to: project.id,
            )
            note = nil
        } catch let refusal as BindingRefusal {
            note = ConnectNote(refusal: refusal)
        } catch {
            note = ConnectNote(refusal: .unreadable(error.localizedDescription))
        }
        await refresh()
    }

    func unbind(_ port: AccountPort) async {
        guard let project else { return }
        await bindings.unbind(port: port, from: project.id)
        note = nil
        await refresh()
    }

    /// Rebuild what the panel draws. Every act ends here rather than editing the reading in place:
    /// a Binding's health is asked of the registries, and a panel that patched its own row would
    /// be showing what it hoped had happened.
    func refresh() async {
        guard isOpen else { return }
        await show(ports: resolvedPorts())
    }

    private func resolvedPorts() async -> [ConnectPort] {
        guard let project else { return [] }
        var resolved: [ConnectPort] = []
        for port in AccountPort.allCases {
            await resolved.append(ConnectPort(
                port: port,
                resolution: bindings.resolve(port: port, for: project.id),
            ))
        }
        return resolved
    }

    private func show(ports: [ConnectPort]) async {
        reading = await ConnectReading(
            folder: project?.path,
            accounts: accounts.load().accounts,
            ports: ports,
            // Argo writes the plugin for every Session it starts, and #570 owns whatever more
            // this row will one day be able to say.
            companion: .includedWithSpawns,
            challenge: challenge,
            note: note,
            // GitHub alone: Linear's grant is #371's, and a control with no flow behind it would
            // do nothing when pressed.
            authorizable: [.github],
            mode: mode,
        )
    }

    func report(_ note: ConnectNote) async {
        self.note = note
        await refresh()
    }
}
