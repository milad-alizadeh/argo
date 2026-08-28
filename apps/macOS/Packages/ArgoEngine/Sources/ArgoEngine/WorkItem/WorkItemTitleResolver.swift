import Foundation

/// The pass that turns every `#<N>` the roster derived into the words the code host holds, and
/// leaves each one where the next launch will find it (#745).
public actor WorkItemTitleResolver {
    private let gitHub: GitHubWorkItemTitles
    private let linear: LinearWorkItemTitles
    private let annotations: SessionAnnotationStore
    /// What each number settled at this launch. Only a SETTLED answer lands here: a read that
    /// established nothing is left out, so one offline moment at launch does not cost that ticket
    /// its name until the next one.
    private var settled: [Int: TicketReading] = [:]

    /// Both adapters, not one per resolver: a Session's ticket is resolved through whatever
    /// Binding its Project holds, and which provider that is changes per Project rather than per
    /// launch.
    public init(
        titles: WorkItemTitleAdapters = WorkItemTitleAdapters(),
        annotations: SessionAnnotationStore,
    ) {
        self.gitHub = titles.gitHub
        self.linear = titles.linear
        self.annotations = annotations
    }

    /// Resolve the Work Item behind each Session, keyed by chain id, and answer the annotations the
    /// roster should now be projected from.
    ///
    /// One read per ticket per launch rather than per call, so a ticket renamed while Argo runs is
    /// stale until the next launch.
    @discardableResult
    public func resolve(
        links: [String: Int], through binding: ResolvedBinding,
    ) async
        -> SessionAnnotations {
        for number in Set(links.values) where settled[number] == nil {
            if let reading = await read(number, through: binding) {
                settled[number] = reading
            }
        }
        var latest = await annotations.load()
        for (sessionID, number) in links {
            guard let reading = settled[number] else { continue }
            latest = await annotations.setTicket(reading, sessionID: sessionID)
        }
        return latest
    }

    /// Which provider's adapter answers, decided here and nowhere else. An exhaustive `switch`, so
    /// a provider added to the domain has to say what names a Work Item through it — and so a
    /// Linear token can never be sent to GitHub.
    private func read(_ number: Int, through binding: ResolvedBinding) async -> TicketReading? {
        switch binding.provider {
        case .github:
            await gitHub.read(
                titleOf: number, in: binding.binding.scope, grant: binding.grant,
            )
        case .linear:
            await linear.read(
                titleOf: number, in: binding.binding.scope, grant: binding.grant,
            )
        }
    }
}
