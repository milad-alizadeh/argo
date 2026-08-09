import Foundation

/// A long address, cut in its MIDDLE.
///
/// A path is identified by both its ends and by neither of its halves: `/private/tmp/claude-501/…`
/// says which machine wrote it and nothing about the file, and a cut at the other end says the file
/// and nothing about where it lives. Cutting the middle out keeps the two ends that identify it and
/// spends the ellipsis on the stretch nobody reads.
///
/// It cuts and never rewrites — every character kept is the agent's own, in its own order, and the
/// ellipsis says what was left behind.
///
/// It sits at the deck's root rather than inside the feed because the evidence panel's header cuts
/// the same kind of thing, and one address must not get two answers depending on which surface is
/// drawing it. The panel still front-cuts today — converting it is its own ticket — so this is
/// where that change reaches for the rule rather than writing a second one.
enum DeckMiddleCut {
    /// The address, whole where it already fits and cut in its middle where it does not. The result
    /// is exactly `readableLength` characters when it was cut, ellipsis included.
    static func applied(to address: String) -> String {
        guard address.count > readableLength else { return address }
        return String(address.prefix(lead))
            + ellipsis
            + String(address.suffix(readableLength - lead - 1))
    }

    /// How many characters an address may take before it is worth cutting. A measurement of what
    /// stays readable rather than of what fits: the surfaces that draw one are laid out in points,
    /// and a rule that asked them how wide they were would give the same address two shapes.
    private static let readableLength = 32

    /// How much of the opening to keep. A third, so the right-hand end — the filename, the part a
    /// reader is looking for — keeps the larger share.
    private static let lead = 10

    private static let ellipsis = "…"
}
