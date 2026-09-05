import ArgoEngine
@testable import ArgoUI
import Testing

/// What a roster row is called once SEVERAL Sessions are on one Ticket (#1072).
///
/// `SessionTicketTitleTests` owns the case where the Ticket names one row, which every claim here
/// must leave exactly as it was. What the row's secondary line then says is
/// `SessionRosterToldApartTests`.
@Suite("Sessions sharing one ticket")
struct SessionRosterRivalTicketTests {
    @Test
    func `several Sessions on one ticket each read their own derived name`() {
        let rows = SessionRosterProjection.rows(from: [
            Self.session(id: "one", title: "Write a caption for one folder"),
            Self.session(id: "two", title: "These two files change together"),
            Self.session(id: "three", title: "Name the widest module here"),
        ])

        #expect(rows.map(\.title) == [
            "Write a caption for one folder",
            "These two files change together",
            "Name the widest module here",
        ])
    }

    @Test
    func `a Session that is the only one on its ticket keeps the ticket's title`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Self.session(id: "one", title: "Write a caption for one folder"),
            Self.session(id: "two", title: "These two files change together"),
            Self.session(id: "alone", title: "/implement 741", issue: Self.anchor),
        ])

        // #745, unchanged: the rows a Ticket does name apart still spend it on the title.
        #expect(try #require(rows.first { $0.id == "alone" }).title == "Anchor the feed")
    }

    @Test
    func `a Session the user renamed is no rival to the ticket's other rows`() {
        let rows = SessionRosterProjection.rows(from: [
            Self.session(id: "named", title: "Write a caption", name: "Tonight"),
            Self.session(id: "titled", title: "Name the widest module"),
        ])

        // Only one row would have drawn the Ticket's words, so nothing was confusable.
        #expect(rows.map(\.title) == ["Tonight", "Rough atlas for Argo itself"])
    }

    @Test
    func `an archived Session on the same ticket still costs the roster row its title`() {
        let sessions = [
            Self.session(id: "live", title: "Name the widest module"),
            Self.session(id: "filed", title: "Write a caption", archived: true),
        ]

        // Both lists are drawn in one column, so a row told apart only from its own list would
        // read the same as one behind the foot.
        #expect(SessionRosterProjection.rows(from: sessions).map(\.title)
            == ["Name the widest module"])
        #expect(SessionRosterProjection.archivedRows(from: sessions).map(\.title)
            == ["Write a caption"])
    }

    @Test
    func `the deck header reads the same title the row gave up the ticket for`() throws {
        let sessions = [
            Self.session(id: "one", title: "Write a caption for one folder"),
            Self.session(id: "two", title: "These two files change together"),
        ]

        // #1391: the header used to resolve this Session against itself alone, so it kept the
        // ticket's words on a row that had just given them up to its rival. It now reads the same
        // decision the row does, across the whole roster.
        let row = try #require(SessionRosterProjection.rows(from: sessions).first)
        let header = SessionHeaderProjection.header(
            from: sessions[0],
            title: SessionTitle.namedTitle(for: sessions[0].id, across: sessions),
        )

        #expect(row.title == "Write a caption for one folder")
        #expect(header.title == "Write a caption for one folder")
    }

    @Test
    func `the rename dialog opens on the name the row is drawing`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Self.session(id: "one", title: "Write a caption for one folder"),
            Self.session(id: "two", title: "These two files change together"),
        ])

        #expect(try #require(rows.first).rename?.name == "Write a caption for one folder")
    }

    @Test
    func `a Reset goes back to the derived name where the ticket names another row`() throws {
        let rows = SessionRosterProjection.rows(from: [
            Self.session(id: "named", title: "Write a caption", name: "Tonight"),
            Self.session(id: "titled", title: "Name the widest module"),
        ])

        // Taking the name off would put two rows on #650, so Reset may not promise its words.
        #expect(try #require(rows.first).rename?.derived == "Write a caption")
    }

    static let atlas = CockpitPresentation.Session
        .Issue(number: 650, title: "Rough atlas for Argo itself")
    static let anchor = CockpitPresentation.Session
        .Issue(number: 741, title: "Anchor the feed")

    static func session(
        id: String,
        title: String,
        issue: CockpitPresentation.Session.Issue = atlas,
        name: String? = nil,
        archived: Bool = false,
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: id, title: title, isArchived: archived, explicitName: name,
            ticket: .linked(issue),
        )
    }
}
