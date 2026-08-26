import ArgoEngine
import ArgoUI
import Foundation
import Observation

/// What the Connect panel is looking at: the Accounts this Mac holds, what each of the active
/// Project's ports reads through, and whatever is in flight.
///
/// The cockpit owns Projects and points the Hub; this owns Accounts and Bindings, which the Hub
/// has never heard of. The Project they share travels in as a value.
@MainActor
@Observable
final class AccountsCoordinator {
    /// The panel's whole input, and `nil` while it is closed. One field for both, so "open" and
    /// "has something to draw" cannot disagree.
    private(set) var reading: ConnectReading?
    private(set) var startsAtWelcome = false
    /// How the active Project's ports are reading, whether or not the panel is up. The chip is
    /// chrome on the window and the panel is a sheet over it, so tying this to the panel would hide
    /// the failure exactly while the user is not looking at the place that reports it.
    private(set) var connections = ConnectionHealthReading.quiet

    /// Reached from `AccountsCoordinator+Grant` and `+Health`, which is why these are not
    /// `private`: `private` in Swift is file-scoped.
    let accounts: AccountRegistryStore
    let bindings: ProjectBindings
    let authorization: GitHubAuthorization
    /// What Argo has observed about each Binding's connection. Live and unpersisted, so a launch
    /// opens on what it can see rather than on what yesterday could.
    let health = ConnectionHealthLedger()

    /// Whether the panel is meant to be up. Kept apart from `reading` because every act ends in a
    /// rebuild, and a rebuild that decided for itself would re-open a panel the user just closed.
    private var isOpen = false
    var project: ProjectRecord?
    private var mode: ConnectPanelMode = .creating
    var challenge: ConnectChallenge?
    private var note: ConnectNote?
    /// The wait on a grant, held so it can be stopped and so a second `Connect` cannot leave two
    /// polls running against one panel.
    var grant: Task<Void, Never>?
    /// The companion row's fact (#570), injected because the channel is the Hub's, not this one's.
    var companionStanding: @MainActor () -> ConnectCompanion = { .unknown }

    init(projects: ProjectRegistryStore) {
        let store = AccountRegistryStore(bindings: ProjectBindingIndex(projects: projects))
        self.accounts = store
        self.bindings = ProjectBindings(projects: projects, accounts: store)
        self.authorization = GitHubAuthorization(accounts: store)
    }

    /// Open the panel on a Project, or on none: onboarding IS creating a Project (ADR-0015), so
    /// the panel with no Project is not an error state — it is the state that produces one.
    ///
    /// The Agent is `.claude` because that is the only one Argo can launch (`AgentCLI`), and
    /// nothing stores a per-Project choice yet.
    func open(on project: ProjectRecord?, welcoming: Bool = false) async {
        self.project = project
        mode = project == nil ? .creating : .settings(agent: .claude)
        startsAtWelcome = welcoming
        note = nil
        isOpen = true
        await refresh()
    }

    /// Whether a machine that has never registered anything should be met by the panel. A first
    /// launch is a machine with no Project, so the registry is asked rather than a flag kept.
    func openIfUnstarted(registry: ProjectRegistry) async {
        guard registry.projects.isEmpty else { return }
        await open(on: nil, welcoming: true)
    }

    func close() {
        cancelWait()
        isOpen = false
        reading = nil
        startsAtWelcome = false
        note = nil
    }

    /// The folder was chosen and the Project registered, so the panel now has something to bind
    /// against. Registering on the pick rather than on `Create project` is what ADR-0015 means:
    /// the folder IS the Project, and the button below it only closes the panel.
    ///
    /// The mode deliberately does NOT move here: a panel that flipped to `Done` the moment a
    /// folder was picked would rename its own button under the user's cursor mid-setup.
    func pointed(at project: ProjectRecord?) async {
        guard isOpen else { return }
        self.project = project
        await refresh()
    }

    /// A folder has to exist first, and the row already says so — this guard is the second line of
    /// that defence, and it names the real cause rather than a registration that went missing.
    func bind(_ binding: ProjectBinding) async {
        guard let project else {
            return await report(ConnectNote(
                what: "There is no project to connect this to yet.",
                why: "A connection is a fact about one project, and none has been created.",
                fix: "Choose a folder first, then pick an account for this row.",
            ))
        }
        do {
            try await bindings.bind(binding, to: project.id)
            note = nil
        } catch let refusal as BindingRefusal {
            note = ConnectNote(refusal: refusal)
        } catch {
            note = ConnectNote(refusal: .unreadable(error.localizedDescription))
        }
        await refresh()
    }

    /// How the active Project's Work Item port reads, for a reader that is not the panel (#745).
    /// The same resolve the panel and the chip make, so no third answer about one Binding exists.
    func workItemBinding() async -> BindingResolution {
        guard let project else { return .unbound }
        return await bindings.resolve(port: .workItem, for: project.id)
    }

    func unbind(_ port: AccountPort) async {
        guard let project else { return }
        await bindings.unbind(port: port, from: project.id)
        note = nil
        await refresh()
    }

    /// Rebuild what the panel draws, and what the connection chip reads. Every act ends here rather
    /// than editing the reading in place: a Binding's health is asked of the registries, and a
    /// panel that patched its own row would be showing what it hoped had happened.
    ///
    /// One resolution feeds both. The chip is chrome on the window and the panel is a sheet over
    /// it, so the chip is rebuilt whether or not the panel is up — and the two can never disagree
    /// about which Account a port reads through, because they are the same read.
    func refresh() async {
        let ports = await resolvedPorts()
        connections = await healthReading(over: ports)
        guard isOpen else { return }
        await show(ports: ports)
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
            companion: companionStanding(),
            challenge: challenge,
            note: note,
            authorizable: ConnectReading.authorizableToday,
            mode: mode,
        )
    }

    func report(_ note: ConnectNote) async {
        self.note = note
        await refresh()
    }

    func clearNote() {
        note = nil
    }
}
