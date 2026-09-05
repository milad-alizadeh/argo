import ArgoEngine
@testable import ArgoUI
import Testing

/// What the roster row's one leading meta slot says: the slash command a Session opened with,
/// where the Ticket already holds the title (#745, #1072). The titles themselves are
/// `SessionRosterRivalTicketTests`.
///
/// The Ticket used to ride this line too, wherever the title fell back to a derived name — it no
/// longer does (#1347): a linked Ticket now has its own address on line 3
/// (`row.ticketNumber`, `DeliveryAddresses`) regardless of what the title says, so repeating the
/// number here would be the row saying it twice.
@Suite("The fact a roster row is told apart by")
struct SessionRosterToldApartTests {
    typealias Fixture = SessionRosterRivalTicketTests

    @Test
    func `the ticket no longer rides the line the rows' own names have taken`() {
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "one", title: "Write a caption for one folder"),
            Fixture.session(id: "two", title: "These two files change together"),
        ])

        #expect(rows.allSatisfy { $0.toldApart == nil })
        // The number is still there — on line 3, not the meta slot.
        #expect(rows.allSatisfy { $0.ticketNumber == 650 })
    }

    @Test
    func `a link the provider has not named yet carries its number on line 3, not the meta slot`() {
        let long = "/implement https://github.com/milad-alizadeh/argo/issues/852"
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "852", title: long, issue: .init(number: 852)),
        ])

        #expect(rows.first?.toldApart == nil)
        #expect(rows.first?.ticketNumber == 852)
        // Off the meta slot and onto its own line, not off a screen reader entirely: the
        // announcement still says the number (#1347).
        #expect(rows.first?.announcement.contains("#852") == true)
    }

    @Test
    func `a row whose own title already names the ticket does not say the number twice`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "one", title: "/implement 650"),
            Fixture.session(id: "two", title: "Write a caption for one folder"),
        ])

        // #745's rule for this slot, unchanged: a fact the title carries is not worth a second
        // reading of it.
        #expect(try #require(rows.first).toldApart == nil)
    }

    @Test
    func `a renamed row's ticket rides line 3 alone, not the meta slot`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "named", title: "Write a caption", name: "Tonight"),
        ])

        #expect(try #require(rows.first).toldApart == nil)
        #expect(try #require(rows.first).ticketNumber == 650)
        #expect(try #require(rows.first).announcement.contains("#650"))
    }
}
