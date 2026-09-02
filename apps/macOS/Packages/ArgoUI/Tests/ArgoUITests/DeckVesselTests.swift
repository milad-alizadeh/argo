import ArgoEngine
@testable import ArgoUI
import Testing

/// What is in the deck's one slot, and which fact decides it.
@Suite("Deck vessel")
struct DeckVesselTests {
    @Test
    func `a driveable Session with nothing pending gets the composer`() throws {
        let vessel = DeckVessel.resolve(for: Self.driveable)
        let composer = try #require(vessel.composer)

        #expect(composer.sessionID == "session")
        #expect(vessel.prompt == nil)
    }

    /// Design decision 6, and the reason the slot is one value: two vessels at once is a state the
    /// deck must not be able to hold.
    @Test
    func `a Permission displaces the composer rather than joining it`() throws {
        let vessel = DeckVessel.resolve(for: Self.blocked)

        #expect(try #require(vessel.prompt).requestID == "permission-1")
        #expect(vessel.composer == nil)
    }

    /// An Allow whose gate died with the PTY answers nothing, so the prompt on an undriveable
    /// Session is exactly the affordance that cannot work. The line takes the slot instead.
    @Test(arguments: [
        CockpitPresentation.Session.Access.external,
        .orphaned,
    ])
    func `a Session Argo cannot drive gets the line even while a Permission is pending`(
        access: CockpitPresentation.Session.Access,
    ) {
        let blocked = Self.session(access: access, permission: Self.request)
        let vessel = DeckVessel.resolve(for: blocked)

        #expect(vessel.unavailable != nil)
        #expect(vessel.prompt == nil)
        #expect(vessel.composer == nil)
    }

    /// A managed Session that reported `ended` is over: still Argo's, and with nothing left to
    /// send to.
    @Test
    func `a Session that is over gets the line rather than a field`() {
        let vessel = DeckVessel.resolve(for: Self.over)

        #expect(vessel.unavailable == .ended)
        #expect(vessel.composer == nil)
    }

    /// The empty deck, not a degraded one — nothing is selected, so there is nothing to steer.
    @Test
    func `nothing selected leaves the slot empty`() {
        let vessel = DeckVessel.resolve(for: nil)

        #expect(vessel == .none)
        #expect(vessel.unavailable == nil)
    }

    /// The composer and the prompt float over the reading; the line is a ROW that replaces the
    /// reading's end, so the feed's clearance is read off this and not off the slot being filled.
    @Test(arguments: [
        (vessel: DeckVessel.resolve(for: driveable), floats: true),
        (vessel: .resolve(for: blocked), floats: true),
        (vessel: .resolve(for: over), floats: false),
        (vessel: .resolve(for: nil), floats: false),
    ])
    func `only the composer and the prompt float over the reading`(
        vessel: DeckVessel,
        floats: Bool,
    ) {
        #expect(vessel.isFloating == floats)
    }

    /// A capability the adapter declares about itself, which the Hub's presentation has never
    /// heard of — so it comes in rather than being derived.
    @Test
    func `whether the adapter takes attachments reaches the composer`() throws {
        let vessel = DeckVessel.resolve(for: Self.driveable, can: .init(canAttach: true))

        #expect(try #require(vessel.composer).canAttach)
    }

    // MARK: - Fixtures
    //
    // Static, because a `@Test(arguments:)` table is built outside the suite instance.

    private static let request = PermissionRequest(
        id: "permission-1",
        toolName: "Bash",
        target: .command("ls"),
    )

    /// Managed, and blocked on nothing — the Session that gets a field.
    private static let driveable = session()
    /// The same Session with a Permission pending.
    private static let blocked = session(permission: request)
    /// Managed and over, which is the line rather than a field.
    private static let over = session(status: .ended)

    private static func session(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus? = nil,
        permission: PermissionRequest? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "A Session",
            access: access,
            status: status ?? (permission == nil ? .idle : .permission),
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: "/Users/someone/repo"),
            autonomy: .init(permission: permission),
        )
    }
}
