import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// A Ticket URL printed in the feed, in the three states the reading has to be judged in (#1178):
/// a link this Project's Binding addresses and the roster has named, one it addresses and nothing
/// has named yet, and one it does not address at all.
///
/// The three stacked in ONE reading, deliberately. The judgement is comparative — the first two
/// have to read as the same kind of thing the roster draws, and the third has to still read as a
/// web link beside them — and three separate stills settle none of that.
///
/// It is a reading and not three rows drawn by hand: the words are worded where the feed words
/// them, so a still here is of the same path the shell renders.
struct FeedTicketLinkSpecimen: View {
    var body: some View {
        SpecimenScene.sessions(Self.rows)
            .environment(\.argoFeedTickets, Self.tickets)
    }

    /// The Binding the window is on, and the one Ticket the roster has read a title for. #1402 is
    /// deliberately absent: a number with no title is worded by its number alone, and that is a
    /// state a bound Project is in every time a link names a Ticket outside the open listing.
    private static let tickets = FeedTicketLinks(
        address: TicketAddress(provider: .github, scope: "milad-alizadeh/argo"),
        titles: [1175: "Anchor the feed on its newest line"],
    )

    private static let rows = [
        FeedRow(id: 0, content: .message(
            "The anchor holds. Fixed under "
                + "https://github.com/milad-alizadeh/argo/issues/1175, which is where the "
                + "measurement lives.",
        )),
        FeedRow(id: 1, content: .message(
            "It was filed against https://github.com/milad-alizadeh/argo/issues/1402 as well, "
                + "which nothing has read a title for yet.",
        )),
        FeedRow(id: 2, content: .message(
            "The upstream report is https://github.com/apple/swift/issues/1175 and the write-up "
                + "is at https://example.com/notes. Neither is this Project's to open.",
        )),
    ]
}
