import ArgoEngine

/// One option as the row draws it: what was offered, the number it was offered under, and whether
/// the answer named it.
///
/// `AskUserQuestion` carries a bare list of labels and the prompt numbers them on the way out, so
/// the number is the row's own — nothing in the record holds it.
struct FeedAskOffer: Equatable, Sendable, Identifiable {
    let ordinal: Int
    let label: String
    /// The line under the label, where the host offered one.
    let detail: String?
    let isChosen: Bool

    var id: Int {
        ordinal
    }

    /// How the number is spelled beside the label.
    var marker: String {
        "\(ordinal)."
    }

    /// The offered options, numbered from one, in the order they were offered.
    ///
    /// Only the FIRST option matching `chosen` is ticked: two options may carry the same words, and
    /// an answer that names those words has named one of them, never both.
    static func numbered(_ options: [Ask.Option], chosen: String?) -> [FeedAskOffer] {
        let taken = chosen.flatMap { label in options.firstIndex { $0.label == label } }
        return options.enumerated().map { index, option in
            FeedAskOffer(
                ordinal: index + 1,
                label: option.label,
                detail: option.detail,
                isChosen: index == taken,
            )
        }
    }
}
