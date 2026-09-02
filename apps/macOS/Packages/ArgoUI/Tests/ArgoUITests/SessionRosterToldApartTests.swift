import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the roster row's one leading meta slot says: the first fact its title is not already
/// saying (#745, #1072). The titles themselves are `SessionRosterRivalTicketTests`.
@Suite("The fact a roster row is told apart by")
struct SessionRosterToldApartTests {
    typealias Fixture = SessionRosterRivalTicketTests

    @Test
    func `the ticket rides the secondary line once the rows have taken their own names`() {
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "one", title: "Write a caption for one folder"),
            Fixture.session(id: "two", title: "These two files change together"),
        ])

        #expect(rows.allSatisfy { $0.toldApart == "#650" })
    }

    @Test
    func `a link the provider has not named yet reads its number on the secondary line`() {
        let long = "/implement https://github.com/milad-alizadeh/argo/issues/852"
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "852", title: long, issue: .init(number: 852)),
        ])

        // The row the ticket opened on: the derived title is cut before its issue number, and the
        // number is the fact the reader was looking for.
        #expect(rows.first?.toldApart == "#852")
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
    func `a renamed row reads the ticket its own name stopped saying`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Fixture.session(id: "named", title: "Write a caption", name: "Tonight"),
        ])

        #expect(try #require(rows.first).toldApart == "#650")
    }
}
