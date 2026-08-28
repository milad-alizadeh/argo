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

/// A GraphQL connection, which is how Linear serves every list.
struct LinearNodes<Node: Decodable>: Decodable {
    let nodes: [Node]

    /// A connection whose page was not asked for reads as empty rather than as absent: every list
    /// here is requested explicitly, so an absent one is a query bug and not a provider silence.
    init(nodes: [Node] = []) {
        self.nodes = nodes
    }
}

/// Where a paged connection got to.
struct LinearPageInfo: Decodable {
    let hasNextPage: Bool
    let endCursor: String?
}
