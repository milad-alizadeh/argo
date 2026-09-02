import AppKit
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
    /// The active Project's listing as the last read left it, for the Tickets room to draw (#820).
    /// Refreshed by every finished read, not by every panel act: the room is on screen whether or
    /// not the Connect panel is.
    private(set) var tickets: [Ticket] = []
    /// Where those items can be READ, on the provider's own site (#872) — the Tickets room's two
    /// link verbs, and `nil` where the port is bound to nothing or the Binding addresses no page.
    /// Published with the listing and off the same resolve, so the room can never open a URL from
    /// one Binding against a backlog read through another.
    private(set) var ticketAddress: TicketAddress?

    /// Reached from `AccountsCoordinator+Grant` and `+Scopes`, which is why these are not
    /// `private`: `private` in Swift is file-scoped.
    let accounts: AccountRegistryStore
    let bindings: ProjectBindings
    let authorization: ProviderAuthorization
    /// What Argo has observed about each Binding's connection. Live and unpersisted, so a launch
    /// opens on what it can see rather than on what yesterday could.
    let health = ConnectionHealthLedger()
    /// Where every Project's listing lands, keyed by Project. Here rather than on the cockpit
    /// because the poll reads through a Binding and files its failures on `health` — both of which
    /// are this half's, and neither of which the Hub has ever heard of.
    let ticketLedger = TicketLedger()
    /// The write half (#872). Computed rather than held: it has no state of its own, and its
    /// transport is `URLSession.shared`.
    var ticketCreator: TicketCreator {
        TicketCreator(bindings: bindings, items: ticketLedger, health: health)
    }

    /// The loop that fills it. Pointed on every `refresh`, which is every act that could have
    /// moved a Binding. Re-pointing at an unchanged one costs nothing — the loop holds what it is
    /// already reading.
    private let poll: TicketPoll

    /// Whether the panel is meant to be up. Kept apart from `reading` because every act ends in a
    /// rebuild, and a rebuild that decided for itself would re-open a panel the user just closed.
    private var isOpen = false
    var project: ProjectRecord?
    private var mode: ConnectPanelMode = .creating
    var challenge: ConnectChallenge?
    /// The one open scope picker, reached from `AccountsCoordinator+Scopes`.
    var scopes: ConnectScopes?
    /// The provider read filling it, held so a second choice cannot leave two answers racing for
    /// one picker.
    var listing: Task<Void, Never>?
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
        self.authorization = ProviderAuthorization(accounts: store)
        self.poll = TicketPoll(
            port: ProviderTickets(),
            ledgers: TicketPoll.Ledgers(health: health, items: ticketLedger),
        )
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
        closePicker()
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
            // The choice was taken. Leaving the picker open would offer the act again under a row
            // that already says it happened.
            closePicker()
        } catch let refusal as BindingRefusal {
            note = ConnectNote(refusal: refusal)
        } catch {
            note = ConnectNote(unreadable: error)
        }
        await refresh()
    }

    /// Point the panel and the chip at a Project, or at none. Raised on every change of active
    /// Project, because connection health is per-project truth surfaced for the active Project
    /// only: a background Project whose provider died stays silent, and you learn on switch.
    func point(at project: ProjectRecord?) async {
        self.project = project
        await refresh()
    }

    /// How the active Project's Ticket port reads, for a reader that is not the panel (#745).
    /// The same resolve the panel and the chip make, so no third answer about one Binding exists.
    func ticketBinding() async -> BindingResolution {
        await bindings.resolve(port: .ticket, forProject: project?.id)
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
        let ports = await ConnectPort.all(of: project?.id, through: bindings)
        // The fold is `ArgoUI`'s, where a test can reach it (ADR-0022). Only the registry read is
        // the coordinator's.
        connections = await ConnectionHealthReading.over(ports, from: .init(
            registry: accounts.load(), ledger: health, projectID: project?.id,
        ))
        // ONE resolve, and both the poll and the room's link verbs are pointed off it: two would
        // let the backlog be read through one Binding while its links addressed another.
        let resolution = await ticketBinding()
        ticketAddress = TicketAddress(binding: resolution)
        // Reported before pointed, always: `point` is the only thing that starts a loop, and it
        // raises the landing itself — so this one call both settles the read and refreshes it.
        await poll.report(to: { [weak self] in await self?.readListing() })
        await poll.point(resolution, at: project?.id)
        guard isOpen else { return }
        await show(ports: ports)
    }

    /// Take what the ledger holds for the active Project. A Project with nothing bound reads EMPTY
    /// rather than keeping the last one's backlog.
    private func readListing() async {
        tickets = await ticketLedger.items(of: project?.id)
    }

    private func show(ports: [ConnectPort]) async {
        reading = await ConnectReading(
            folder: project?.path,
            accounts: accounts.load().accounts,
            ports: ports,
            companion: companionStanding(),
            challenge: challenge,
            scopes: scopes,
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
