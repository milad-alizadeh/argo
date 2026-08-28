import Foundation

/// One GraphQL variable, as a value rather than as `Any`.
///
/// Typed because the alternative crosses an isolation boundary — `[String: Any]` is not
/// `Sendable` — and because it makes `null` something the caller STATES rather than a key it
/// omits, which is the difference between clearing a parent and leaving it alone.
enum LinearValue: Equatable, Sendable, Encodable {
    case string(String)
    case int(Int)
    case bool(Bool)
    case null
    case list([LinearValue])
    case object([String: LinearValue])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .string(text): try container.encode(text)
        case let .int(number): try container.encode(number)
        case let .bool(flag): try container.encode(flag)
        case .null: try container.encodeNil()
        case let .list(values): try container.encode(values)
        case let .object(fields): try container.encode(fields)
        }
    }
}

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
