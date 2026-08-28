import Foundation

/// The one endpoint Linear serves from, and how its answers are read.
///
/// GraphQL, so there is no path to name per read: every operation — a listing, a title, a
/// mutation — is a POST to this URL and what was asked for travels in the body.
enum LinearAPI {
    static let endpoint = "https://api.linear.app/graphql"

    /// Linear's fields arrive camel-cased already, so no key strategy: giving one would rename
    /// `priorityLabel` to something no model here declares.
    static var decoder: JSONDecoder {
        JSONDecoder()
    }

    /// Prose Linear served, and `nil` where what it served was nothing to render. Absent and blank
    /// are one state for every string this adapter reads: neither is a body, and neither is a name.
    static func text(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == true ? nil : trimmed
    }

    /// A provider colour in the one shape `WorkItemLabel` holds: six hex digits, no `#`. Linear
    /// serves the `#`; GitHub does not, and a surface that had to know which provider a chip came
    /// from to read its colour would be reading through the port rather than out of it.
    static func hex(_ value: String?) -> String? {
        text(value).map { $0.hasPrefix("#") ? String($0.dropFirst()) : $0 }
    }

    /// Linear serves timestamps with fractional seconds, which the bare `.iso8601` strategy will
    /// not parse, and older ones without, which the fractional strategy will not. Both are tried,
    /// and `nil` is what neither reads: an invented age would put a ticket at the head of a
    /// ranking that sorts by neglect.
    static func timestamp(_ text: String?) -> Date? {
        guard let text else { return nil }
        let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        if let parsed = try? Date(text, strategy: fractional) {
            return parsed
        }
        return try? Date(text, strategy: .iso8601)
    }
}
