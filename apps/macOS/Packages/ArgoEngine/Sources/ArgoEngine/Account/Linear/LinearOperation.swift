import Foundation

/// One GraphQL operation as Linear takes it: the document, and the variables it names.
///
/// The document is a constant and everything the caller supplies travels as a variable, so a
/// scope or a title carrying a quote is data Linear refuses rather than a query that means
/// something else — the rule `LinearScopeCheck` already reads by.
struct LinearOperation: Equatable, Sendable, Encodable {
    let query: String
    let variables: [String: LinearValue]

    init(_ query: String, _ variables: [String: LinearValue] = [:]) {
        self.query = query
        self.variables = variables
    }
}
