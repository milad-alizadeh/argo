import Foundation

/// One of Argo's two adapter ports — the kind of external truth a Binding reads through
/// (ADR-0014, ADR-0018).
///
/// It appears at the Account level only to say what a removal would orphan: a Binding is named by
/// the Project it belongs to and the port it fills, and #B is what creates them.
public enum AccountPort: String, Sendable, Codable, CaseIterable {
    case ticket
    case codeHost

    /// A registry written before #881 spells this port `workItem`. The word is read and never
    /// written, so a file migrates the first time anything saves it.
    private static let legacy = ["workItem": AccountPort.ticket]

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let word = try container.decode(String.self)
        guard let port = AccountPort(rawValue: word) ?? Self.legacy[word] else {
            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "\(word) names no port",
            )
        }
        self = port
    }
}
