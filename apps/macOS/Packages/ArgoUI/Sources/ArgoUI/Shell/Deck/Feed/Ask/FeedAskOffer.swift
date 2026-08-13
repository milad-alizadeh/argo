/// One option as the row draws it: what was offered, the number it was offered under, and whether
/// the answer named it.
///
/// `AskUserQuestion` carries a bare list of labels and the prompt numbers them on the way out, so
/// the number is the row's own — nothing in the record holds it.
struct FeedAskOffer: Equatable, Sendable, Identifiable {
    let ordinal: Int
    let label: String
    let isChosen: Bool

    var id: Int {
        ordinal
    }

    /// How the number is spelled beside the label.
    var marker: String {
        "\(ordinal)."
    }

    /// The offered labels, numbered from one, in the order they were offered.
    ///
    /// Only the FIRST label matching `chosen` is marked: two options may carry the same words, and
    /// an answer that names those words has named one of them, never both.
    static func numbered(_ labels: [String], chosen: String?) -> [FeedAskOffer] {
        let taken = chosen.flatMap(labels.firstIndex(of:))
        return labels.enumerated().map { index, label in
            FeedAskOffer(ordinal: index + 1, label: label, isChosen: index == taken)
        }
    }
}
