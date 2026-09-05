import ArgoDesign
import ArgoEngine
import SwiftUI

/// The detail side of the split view, split off `CockpitView.body` so the type-checker can still
/// see through it: with the evidence toggle's state and the room's toolbar in one expression, the
/// body stopped type-checking in reasonable time.
extension CockpitView {
    /// What is in the deck's one slot for the selected Session — the composer, the Permission
    /// displacing it, the line saying there is nothing to steer, or nothing at all. One decision,
    /// made in `DeckVessel` where a test can reach it.
    var vessel: DeckVessel {
        DeckVessel.resolve(
            for: presentation.session(navigation.session),
            can: capabilities,
        )
    }

    /// What the selected Session's adapter declares, read as one value off the port (#761). With no
    /// Session selected there is nothing to ask about and nothing to draw: `DeckVessel` gives that
    /// case no composer at all, so the defaults below are never rendered.
    private var capabilities: SessionComposerProjection.Capabilities {
        guard let sessionID = navigation.session else { return .init() }
        let surface = actions.drive.surface(of: sessionID)
        return SessionComposerProjection.Capabilities(
            canAttach: surface.takesAttachments,
            canRunCommands: surface.runsCommands,
            resolvesMentions: surface.resolvesMentions,
            chooses: surface.chooses,
        )
    }

    /// What the tab line's Ticket picker offers over the selected Session (#1092) — the backlog
    /// the room already read, and the write that lands a choice.
    var linking: SessionTicketLinking {
        SessionTicketLinking.over(
            tickets: tickets,
            session: presentation.session(navigation.session),
            link: actions.sessions.setTicketLink,
        )
    }

    /// Takes the room and the reading already assembled rather than reading `ticketsRoom` or
    /// `reading` again — see the notes there. `isDrawn` is why the reading may be `none` beside a
    /// Session that is very much selected — see `DrawnSession`.
    @ViewBuilder func detail(
        tickets: TicketsRoom,
        atlas: AtlasRoom,
        reading: SessionsRoomReading,
        isDrawn: Bool,
    )
        -> some View {
        @Bindable var navigation = navigation

        // Resolved once and handed on: reading it a second time re-runs the selection lookup and
        // every projection behind it.
        let vessel = vessel

        InstrumentDeckShell(
            room: navigation.room,
            session: navigation.session,
            feed: reading.feed,
            header: reading.header,
            handOff: handOff,
            createPullRequest: createPullRequest,
            showing: reading.showing,
            open: $openEvidence,
            step: $evidenceStep,
            vessel: vessel,
            intents: intents(for: vessel),
            readings: subagents.stamped(reading.stamp),
            scope: $feedScope,
            tickets: tickets,
        )
        // The Atlas room, injected from ABOVE the deck for the reason `argoAtlasRoom` states.
        .environment(\.argoAtlasRoom, atlas)
        // What the chain link at the foot of a handed-off reading does. Injected here because
        // this is the one view that holds the navigation.
        .environment(\.argoOpenSession) { fresh in navigation.session = fresh }
        // What the tab line's Ticket link does (#1092) — the mirror of the Session link above,
        // reaching the OTHER room rather than another row of this one.
        .environment(\.argoOpenTicket) { navigation.openTicket($0) }
        // …and what the same link's picker does (#1092). Injected from here for the reason above,
        // plus one of its own: the offering is over the SELECTED Session, and this is where the
        // selection and the backlog behind it are both in hand.
        .environment(\.argoTicketLinking, linking)
        // What a waiting ask row's options and its `Answer` do (#712). Injected here for the
        // reason above: the rows are hosted per table cell, and this is where the Session the
        // answer addresses is known.
        .environment(\.feedAskAnswering, answer(on: reading.asking.live))
        // The wait Argo is holding on this reading (#1323). Injected here because this is the one
        // view that has the reading in hand, and it reaches a column four views down that could not
        // derive it: a wait is not written into the rows while it runs.
        .environment(\.argoFeedWait, reading.wait)
        // Whether the Turn in flight is one Argo itself submitted (#1179, #1323) — the DIRECT gate
        // `FeedColumn` stands the `.thinking` plinth behind, injected beside the wait above for
        // the same reason.
        .environment(\.argoTurnIsDirect, reading.hasUnansweredTurn)
        // Injected from ABOVE the deck, which is the whole point of it: a Session switch below
        // replaces the feed's rows in place, and the heights this remembers are keyed per
        // reading rather than per pass so a row does not measure twice for a switch back (#858).
        // The room switch itself no longer tears the table down at all (#1356).
        .environment(\.argoFeedGeometries, feedGeometries)
        // Beside the heights, and from the same view, for the same reason — see `KeptDecks`.
        .environment(\.argoFeedDecks, feedDecks)
        // Why the deck has nothing to read, where an empty feed alone cannot say. The header is
        // what answers "did a Session resolve" — it is `nil` exactly when the selection named
        // none — so this costs no second lookup into a roster that moves under an id (#957).
        //
        // `sessions` and not the rail's own two lists: `SessionRosterProjection` PARTITIONS them on
        // `isArchived`, so this is the same question `SessionNavigator` asks with
        // `rows.isEmpty, archived.isEmpty`. An archived-only roster is `unselected` deliberately —
        // the foot's rows are selectable, so there IS a Session to point the reader at.
        .environment(\.argoFeedVacancy, vacancy(of: reading, isDrawn: isDrawn))
        .overlay(alignment: .topLeading) {
            ConnectionChips(
                connection: presentation.connection,
                projectID: presentation.activeProjectID,
                health: health,
                actions: actions,
            )
            .padding(ArgoSpacing.section)
        }
        // On the DETAIL pane, not on the split view. A split view divides the bar into a
        // region per column, and a flexible spacer only expands inside its own — declared
        // on the split view it landed in a region that spans nothing, which left Rooms
        // parked beside the scope vessel instead of at the trailing edge.
        .toolbar {
            ShellToolbar(
                scope: ScopeVessel(presentation: presentation, actions: actions),
                spawn: spawn(in: navigation),
                evidence: evidenceControl(in: reading),
            )
        }
    }

    /// Why the deck has nothing to read, where an empty feed alone cannot say — see `FeedVacancy`.
    ///
    /// The header answers "did a Session resolve": it is `nil` exactly when the selection named
    /// none, so this costs no second lookup into a roster that moves under an id (#957). Which also
    /// makes it the wrong reading in the rooms that TAKE no reading, where it is `nil` beside a
    /// Session that is very much selected — hence the room gate.
    ///
    /// `sessions` and not the rail's own two lists: `SessionRosterProjection` PARTITIONS them on
    /// `isArchived`, so this asks what `SessionNavigator` asks with `rows.isEmpty` and
    /// `archived.isEmpty`. An archived-only roster reads `unselected` deliberately — there IS a
    /// Session to point the reader at, behind the foot.
    private func vacancy(of reading: SessionsRoomReading, isDrawn: Bool) -> FeedVacancy {
        guard navigation.room == .sessions else { return .silent }
        return .reading(
            hasSelection: reading.header != nil,
            hasSessions: !presentation.sessions.isEmpty,
            // A room with nothing pointed at is not a room waiting to be drawn: the deferral is
            // per SELECTION, and there is no reading coming for an empty one.
            isDrawn: isDrawn || navigation.session == nil,
        )
    }
}
