import ArgoEngine

/// What the shell draws that the Hub's projection does not carry: how the active Project's provider
/// Bindings are reading, the Tickets those Bindings last listed, and where they can be read on the
/// provider's own site.
///
/// One value rather than three parameters, for `CockpitPresentation.Readings`' reason (#755): they
/// cross one seam, not one of them is a Hub fact the projection restates, and the cap is lowered by
/// grouping rather than raised to fit an initialiser (rules/code-style.md).
public struct ShellReadings: Equatable, Sendable {
    /// How the active Project's provider Bindings are reading. Not a Hub fact: the cockpit is a
    /// projection of the Hub, and Accounts and Bindings are registry facts the Hub never heard of.
    public let health: ConnectionHealthReading
    /// The active Project's Tickets as the ledger holds them (#820) — the poll's own listing, the
    /// ones followed by number (#895), and what the closed read answered (#1075).
    ///
    /// The ledger's value WHOLE rather than a field per read, so a fourth read costs this seam
    /// nothing and cannot arrive here beside a stale half of a third.
    public let tickets: TicketLedger.Reading
    /// Where this Project's Tickets can be READ, on the provider's own site (#872). `nil` where the
    /// port is bound to nothing, which disables the row's two link verbs.
    public let ticketAddress: TicketAddress?
    /// A window bound to nothing and listing nothing — the honest default for a preview, a
    /// specimen and a test.
    public static let none = ShellReadings()

    public init(
        health: ConnectionHealthReading = .quiet,
        tickets: TicketLedger.Reading = .nothing,
        ticketAddress: TicketAddress? = nil,
    ) {
        self.health = health
        self.tickets = tickets
        self.ticketAddress = ticketAddress
    }
}
