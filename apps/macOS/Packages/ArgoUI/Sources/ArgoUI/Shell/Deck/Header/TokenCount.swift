import Foundation

/// A token count as a person reads one: `217k`, `1M`, `984`.
///
/// One rounding rule, shared by every surface that spells a count.
///
/// Not `NumberFormatter`'s `.short` style: that is locale-shaped prose ("218K"), and these are
/// machine facts set in the machine face beside a `/`.
enum TokenCount {
    /// The fresh half of a bill, labelled: `1.83M tokens spent`.
    ///
    /// Spelled here rather than at each surface, because the header and the foot of a reading have
    /// to be readable side by side (#1177) and a phrase pasted twice drifts once.
    static func spent(_ count: Int) -> String {
        "\(short(count)) tokens spent"
    }

    /// The cache half of the same bill, labelled: `28.1M cached`.
    ///
    /// Never summed into the half above. Every request re-reads the whole conversation from cache,
    /// so one figure counts the same context once per Turn: it grows with the number of REQUESTS
    /// rather than with the work, and reached `2.3M tokens` beside a context gauge reading
    /// `79.9k / 1M` (#1177).
    static func cached(_ count: Int) -> String {
        "\(short(count)) cached"
    }

    /// Coarser as the number grows: a tenth of a thousand is usable, a tenth of a hundred thousand
    /// is noise on a reading that changes every turn.
    static func short(_ count: Int) -> String {
        if count >= 1_000_000 {
            let decimals = count.isMultiple(of: 1_000_000) ? 0 : 2
            return scaled(count, by: 1_000_000, decimals: decimals) + "M"
        }
        if count >= 1000 {
            let thousands = scaled(count, by: 1000, decimals: count >= 100_000 ? 0 : 1)
            // Rounding can carry a reading over the unit it was picked for: `999_999` scales to
            // `1000k`, which is a million said the long way.
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
