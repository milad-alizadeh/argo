/// Starting a Session, and pointing the roster at it.
///
/// One type because the act has two halves and TWO callers — the toolbar button and the File menu.
/// A caller that could raise the first half without the second would leave an agent running that
/// the reader then has to go and find, and two callers spelling the pair separately is how one of
/// them ends up doing only the spawn.
///
/// The division is the handoff's (`CockpitView.handOff`): the app performs the spawn, the shell
/// decides what to point at.
@MainActor
package struct CockpitSpawn {
    let offer: NewSessionOffer
    private let actions: CockpitActions
    private let navigation: CockpitNavigationModel

    package init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        navigation: CockpitNavigationModel,
    ) {
        self.offer = NewSessionOffer(presentation: presentation)
        self.actions = actions
        self.navigation = navigation
    }

    /// The refusal is checked here as well as drawn, because a shortcut reaches the action without
    /// passing the button that is disabled.
    func run() async {
        guard offer.isLaunchable, let fresh = await actions.sessions.spawn() else { return }
        navigation.pointAtStarting(fresh)
    }

    /// The handoff's half of the same act (#513, #1229). The app runs `/handoff`, waits for the
    /// brief and spawns; the shell points at what came back — which is the division this type's own
    /// note describes, written down here rather than left as a line in a view no test can reach.
    ///
    /// A handoff that did not land answers `nil` and the selection stays exactly where the reader
    /// left it: the failure is reported in that Session's own reading, so moving off it would take
    /// the row away from the news.
    func run(handingOff sessionID: String, issue: Int?) async {
        guard let fresh = await actions.sessions.handOff(sessionID, issue) else { return }
        navigation.pointAtStarting(fresh)
    }

    /// The same act in another Session's folder — what the line on an undriveable Session offers
    /// (#546). `offer` is not consulted: what that check refuses is a spawn with no reachable
    /// Project folder to run in, and this one brings its own.
    func run(beside sessionID: String) async {
        guard let fresh = await actions.sessions.spawnBeside(sessionID) else { return }
        navigation.pointAtStarting(fresh)
    }
}
