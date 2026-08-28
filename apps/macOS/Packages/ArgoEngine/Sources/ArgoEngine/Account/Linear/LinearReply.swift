import Foundation

/// What Linear answers any operation with: a payload, a list of refusals, or both.
///
/// Both fields are optional and neither is the other's absence — a body carrying `errors` and a
/// null `data` is Linear saying no, and a body carrying neither is not Linear answering at all.
struct LinearReply<Payload: Decodable>: Decodable {
    let data: Payload?
    let errors: [Message]?

    struct Message: Decodable {
        let message: String
    }

    /// Linear's own words about why this did not land, and `nil` where it did.
    ///
    /// Joined rather than reduced to the first: a refusal naming two missing fields says two
    /// things, and the caller renders the sentence verbatim.
    var refusal: String? {
        guard let errors, !errors.isEmpty else { return nil }
        return errors.map(\.message).joined(separator: " ")
    }
}
