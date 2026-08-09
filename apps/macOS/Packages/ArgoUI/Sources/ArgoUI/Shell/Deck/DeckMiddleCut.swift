import Foundation

/// A long address, cut in its MIDDLE.
///
/// A path is identified by both its ends and by neither of its halves: `/private/tmp/claude-501/…`
/// says which machine wrote it and nothing about the file, and a cut at the other end says the file
/// and nothing about where it lives. Cutting the middle out keeps the two ends that identify it and
/// spends the ellipsis on the stretch nobody reads.
///
/// It cuts and never rewrites — every character kept is the agent's own, in its own order, and the
/// ellipsis says what was left behind. One rule rather than two: the feed's command line and the
/// evidence panel's header are both cutting the same kind of thing, and two implementations of one
/// rule would drift into two answers for one address.
enum DeckMiddleCut {
    /// How many characters an address may take before it is worth cutting. A measurement of what
    /// stays readable rather than of what fits: the surfaces that draw one are laid out in points,
    /// and a rule that asked them how wide they were would give the same address two shapes.
    static let readable = 32

    /// The address, whole where it already fits and cut in its middle where it does not. The result
    /// is exactly `limit` characters when it was cut, ellipsis included.
    static func applied(to address: String, keeping limit: Int = readable) -> String {
        guard address.count > limit, limit > lead + 1 else { return address }
        return String(address.prefix(lead)) + ellipsis + String(address.suffix(limit - lead - 1))
    }

    /// How much of the opening to keep. A third, so the right-hand end — the filename, the part a
    /// reader is looking for — keeps the larger share.
    private static let lead = 10

    private static let ellipsis = "…"
}
