/// One option as the row draws it: what was offered, the number it was offered under, and whether
/// the answer named it.
///
/// The number is the row's, not the record's — `AskUserQuestion` carries a bare list of labels and
/// the prompt numbers them on the way out. Drawing the same numbers is what makes the row and the
/// terminal the same question.
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
}
