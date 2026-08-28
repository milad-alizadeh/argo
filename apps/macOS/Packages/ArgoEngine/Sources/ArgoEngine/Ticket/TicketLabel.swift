/// One of a provider's own labels — the word it spells, and the colour it draws the word in.
///
/// The colour is the PROVIDER's fact, not Argo's (`CONTEXT.md` L1 · Ticket): a reader who set
/// `bug` to red on the tracker has said something, and inventing a different hue here would put a
/// second, quieter claim on screen beside the true one. `nil` where the adapter read no colour,
/// which is a silence and not a default — the chip then draws in the neutral it always did
/// (`CONTEXT.md` L2 · degrade-down).
///
/// The hex is held verbatim as the provider serves it: six digits, no `#`, in whatever case it
/// arrived. Reading it into a colour is a SURFACE's job, because a colour is a rendering decision
/// and this package draws nothing.
public struct TicketLabel: Equatable, Hashable, Sendable, Identifiable {
    public let name: String
    public let colour: String?

    public init(name: String, colour: String? = nil) {
        self.name = name
        self.colour = colour
    }

    /// The name, which is unique per ticket on every provider Argo reads.
    public var id: String {
        name
    }
}
