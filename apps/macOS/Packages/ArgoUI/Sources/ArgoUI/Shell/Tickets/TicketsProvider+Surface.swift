import ArgoEngine

/// What the bound Ticket adapter DECLARES it can write (#1247) — read before a control is drawn,
/// never after a write comes back refused (ADR-0014).
extension TicketsProvider {
    /// `nil` where nothing is bound to the Ticket port, which is also where no write control is
    /// drawn at all.
    static func surface(of reading: ConnectionHealthReading) -> TicketSurface? {
        guard let found = reading.connections.first(where: { $0.port == .ticket })
        else { return nil }
        return ProviderTicketWrites().port(of: found.account.provider).surface
    }
}
