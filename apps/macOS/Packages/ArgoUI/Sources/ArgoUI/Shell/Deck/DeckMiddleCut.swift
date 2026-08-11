import Foundation

/// A long address, cut in its MIDDLE.
///
/// A path is identified by both its ends and by neither of its halves: `/private/tmp/claude-501/…`
/// says which machine wrote it and nothing about the file. It cuts and never rewrites — every
/// character kept is the agent's own, in its own order.
///
/// At the deck's root rather than inside the feed: the evidence panel's header cuts the same kind
/// of thing, and one address must not get two answers depending on the surface drawing it.
enum DeckMiddleCut {
    /// The address, whole where it already fits and cut in its middle where it does not. The result
    /// is exactly `keeping` characters when it was cut, ellipsis included.
    static func applied(to address: String, keeping length: Int = readableLength) -> String {
        guard address.count > length else { return address }
        let lead = length / leadShare
        return String(address.prefix(lead))
            + ellipsis
            + String(address.suffix(length - lead - 1))
    }

    /// How many characters an address may take, per line, before it is worth cutting. A measurement
    /// of what stays readable rather than of what fits: the surfaces that draw one are laid out in
    /// points, and a rule that asked them their width would give the same address two shapes.
    private static let readableLength = 32

    /// How much of the opening to keep — a third, so the right-hand end keeps the larger share. A
    /// share rather than a count, so a longer reading spends its extra room on both ends.
    private static let leadShare = 3

    private static let ellipsis = "…"
}
