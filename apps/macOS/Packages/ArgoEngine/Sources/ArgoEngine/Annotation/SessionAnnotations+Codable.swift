import Foundation

/// The on-disk shape, parsed at the boundary.
///
/// An annotation carries only what it was told, so a file written by a build that knew one fact
/// still reads under a build that knows two — and a fact it does not carry decodes to what every
/// unannotated Session already has, rather than failing the record around it.
extension SessionAnnotations: Codable {
    private enum CodingKeys: String, CodingKey {
        case sessions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let sessions = try container
            .decodeIfPresent([String: Annotation].self, forKey: .sessions)
        self.init(bySessionID: sessions ?? [:])
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(bySessionID, forKey: .sessions)
    }
}

extension SessionAnnotations.Annotation: Codable {
    private enum CodingKeys: String, CodingKey {
        case archived
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let archived = try container.decodeIfPresent(Bool.self, forKey: .archived)
        self.init(isArchived: archived ?? false)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(isArchived, forKey: .archived)
    }
}
