import ArgoEngine
import ArgoUI

/// The claim join's fixtures — every reading whose subject is WHICH tickets live Sessions hold,
/// and who holds them. Split out of `TicketsFixture` because the enum's body has a cap and these
/// are the one group of readings that shares a subject rather than a page (#1191).
package extension TicketsFixture {
    /// The claim join's three placed tickets, named (#1092) — each the one live Session on it, so
    /// the head's route and the row's mark come off the same claimant a reader could actually open.
    /// One claimant per ticket draws its own ticket's words as its name, the real shape a Session
    /// takes when it is the only one on a ticket (`SessionTitle.namesOneRow`).
    static let namedClaimants: [Int: [TicketClaims.Claimant]] = [
        388: [TicketClaims.Claimant(id: "session-388", name: title(388))],
        609: [TicketClaims.Claimant(id: "session-609", name: title(609))],
        763: [TicketClaims.Claimant(id: "session-763", name: title(763))],
    ]

    private static func title(_ number: Int) -> String {
        guard let item = items.first(where: { $0.number == number }) else {
            preconditionFailure("TicketsFixture.title: no item #\(number)")
        }
        return item.title
    }

    /// #272 with a SECOND live Session on it too — the head's other honest state (#1092): two
    /// claimants, neither of which may draw the ticket's own words as a name
    /// (`SessionTitle.namesOneRow`), so both take names of their own.
    /// One running and one idle, deliberately: the list the count opens onto answers WHICH of the
    /// two is working, and a fixture where both read the same would render a list that has never
    /// been asked to tell them apart.
    static let twoClaimants: [TicketClaims.Claimant] = [
        .init(id: "session-272-a", name: "Fix the generic node tree crash", status: .running),
        .init(id: "session-272-b", name: "/implement 272", status: .idle),
    ]

    /// Two live Sessions whose own ticket link Argo could not name, so the claim join is SHORT by
    /// two and says so (#1074). The other three views are unaffected: their ground was read.
    ///
    /// A fixture of its own because no other one reaches this state: every reading here sets
    /// `claimed` outright, which asserts every live Session was placed.
    static let unjoinedClaims = TicketsReading(
        items: items,
        claims: TicketClaims(numbers: [388, 609], unplaced: 2),
        provider: bound,
        project: project,
        showing: 388,
    )

    /// The main reading with #272 claimed as well, which makes it claimed AND blocked — the row no
    /// other fixture reaches (#1074). A delta on `reading` rather than a listing of its own, so the
    /// other three claims cannot drift from the room every other render draws.
    ///
    /// #272 is claimed by TWO Sessions (#1092) — the head's other honest state, which needs a
    /// blocked-and-claimed row anyway, so this is the one fixture that reaches it without a
    /// listing of its own.
    static var claimedAndBlocked: TicketsReading {
        claiming(reading) { $0[272] = twoClaimants }
    }

    /// The closed reading with two of its closed tickets still CLAIMED — a live Session named the
    /// ticket, the ticket was then closed, and closing it did not end the Session, so the number
    /// stays in the join (#1191). The one state where the claim and the closure disagree, and the
    /// state no other fixture reaches: every claim above is on an open ticket.
    ///
    /// Both closed words are claimed, `resolved` and `ruledOut`, so a suppression keyed to one of
    /// them cannot pass this.
    static var claimedAfterClosing: TicketsReading {
        claiming(closedRead) {
            $0[690] = [TicketClaims.Claimant(id: "session-690", name: "/implement 690")]
            $0[186] = [TicketClaims.Claimant(id: "session-186", name: "/implement 186")]
        }
    }

    /// The same reading with more tickets claimed — the shape both deltas above take. The two
    /// shortfalls are carried across rather than recomputed: adding a claimant places no Session
    /// that was previously unplaced, and reads no link that was previously unread.
    private static func claiming(
        _ reading: TicketsReading,
        _ place: (inout [Int: [TicketClaims.Claimant]]) -> Void,
    )
        -> TicketsReading {
        var reading = reading
        var claimants = reading.claims.claimants
        place(&claimants)
        reading.claims = TicketClaims(
            claimants: claimants,
            unplaced: reading.claims.unplaced,
            unread: reading.claims.unread,
        )
        return reading
    }

    /// Nothing bound to join against, so no live Session's link could be read at ALL and the count
    /// is genuinely nothing rather than partial. The unread half of the pair above, drawn.
    static let unreadClaims = TicketsReading(
        items: items,
        claims: TicketClaims(numbers: [], unread: 1),
        provider: bound,
        project: project,
        showing: 388,
    )
}
