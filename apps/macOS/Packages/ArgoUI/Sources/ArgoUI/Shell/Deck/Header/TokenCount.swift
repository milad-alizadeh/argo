import Foundation

/// A token count as a person reads one: `217k`, `1M`, `984`.
///
/// Its own type rather than a private helper on the context projection, because the header is not
/// the only surface that will spell a token count — the spend line beside the tabs is the next —
/// and two roundings of the same number on one screen is the kind of drift nobody notices until
/// they disagree.
///
/// Not `NumberFormatter`'s `.short` style: that is locale-shaped prose ("218K"), and these are
/// machine facts set in the machine face beside a `/`. What is wanted is one rounding rule,
/// written down.
enum TokenCount {
    /// Coarser as the number grows, which is the whole point: a tenth of a thousand is a fact
    /// somebody might use, and a tenth of a hundred thousand is noise on a reading that changes
    /// every turn.
    static func short(_ count: Int) -> String {
        if count >= 1_000_000 {
            let decimals = count.isMultiple(of: 1_000_000) ? 0 : 2
            return scaled(count, by: 1_000_000, decimals: decimals) + "M"
        }
        if count >= 1000 {
            let thousands = scaled(count, by: 1000, decimals: count >= 100_000 ? 0 : 1)
            // Rounding can carry a reading over the unit it was picked for: `999_999` scales to
            // `1000k`, which is a million said the long way and a reading nobody would compare
            // against the `1M` beside it.
            return thousands == "1000" ? "1M" : thousands + "k"
        }
        return "\(count)"
    }

    /// A trailing `.0` is dropped, so a round number reads round: `12k`, never `12.0k`.
    private static func scaled(_ count: Int, by unit: Int, decimals: Int) -> String {
        var text = String(format: "%.\(decimals)f", Double(count) / Double(unit))
        while text.contains("."), text.hasSuffix("0") {
            text.removeLast()
        }
        if text.hasSuffix(".") {
            text.removeLast()
        }
        return text
    }
}
