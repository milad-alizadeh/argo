import Foundation

/// The pass that turns every `#<N>` the roster derived into the words the code host holds, and
/// leaves each one where the next launch will find it (#745).
public actor TicketTitleResolver {
    private let gitHub: GitHubTicketTitles
    private let linear: LinearTicketTitles
    private let annotations: SessionAnnotationStore
    /// Where a Ticket's words go BESIDES the annotation file (#1494).
    private let mirror: TicketTitleMirror
    /// What each number settled at this launch. Only a SETTLED answer lands here: a read that
    /// established nothing is left out, so one offline moment at launch does not cost that ticket
    /// its name until the next one.
    private var settled: [Int: TicketTitleReading] = [:]
    /// The title each Session's CLI was last told, keyed by chain id (#1494). Only a title that
    /// actually WENT lands here, so a mirror the prompt was too busy to take is tried again on the
    /// next sweep rather than costing that Session its name for the launch.
    private var mirrored: [String: String] = [:]

    /// Both adapters, not one per resolver: a Session's ticket is resolved through whatever
    /// Binding its Project holds, and which provider that is changes per Project rather than per
    /// launch.
    public init(
        titles: TicketTitleAdapters = TicketTitleAdapters(),
        annotations: SessionAnnotationStore,
        mirror: TicketTitleMirror = .silent,
    ) {
        self.gitHub = titles.gitHub
        self.linear = titles.linear
        self.annotations = annotations
        self.mirror = mirror
    }

    /// Resolve the Ticket behind each Session, keyed by chain id, and answer the annotations the
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
            await carry(reading, to: sessionID, in: latest)
        }
        return latest
    }

    /// Type the Ticket's words at the Session's own prompt, so Claude's other surfaces show the
    /// name Argo's roster shows (#1494).
    ///
    /// Three things stop it, and each is silence rather than a failure. A title this Session's CLI
    /// has already been told, because this pass runs whenever an untitled number appears and a
    /// mirror per pass would retype `/rename` at a Session that has been sitting on the right name
    /// for hours. A reading with no words, because there is nothing to say. And a Session the user
    /// has NAMED, because their name is what the roster draws — mirroring the ticket over it is
    /// exactly the disagreement this ticket exists to end.
    ///
    /// What went is remembered and what did not is not, so a prompt that was busy this sweep is
    /// asked again on the next one.
    private func carry(
        _ reading: TicketTitleReading,
        to sessionID: String,
        in latest: SessionAnnotations,
    ) async {
        guard let title = reading.title, mirrored[sessionID] != title,
              latest.explicitName(sessionID) == nil
        else { return }
        guard await mirror.carry(title, sessionID) else { return }
        mirrored[sessionID] = title
    }

    /// Which provider's adapter answers, decided here and nowhere else. An exhaustive `switch`, so
    /// a provider added to the domain has to say what names a Ticket through it — and so a
    /// Linear token can never be sent to GitHub.
    private func read(
        _ number: Int,
        through binding: ResolvedBinding,
    ) async
        -> TicketTitleReading? {
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
