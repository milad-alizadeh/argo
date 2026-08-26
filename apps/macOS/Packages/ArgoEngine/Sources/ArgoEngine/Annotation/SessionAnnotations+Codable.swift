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
        case name
        case ticketTitle
        case ticketAbsent
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let archived = try container.decodeIfPresent(Bool.self, forKey: .archived)
        let name = try container.decodeIfPresent(String.self, forKey: .name)
        try self.init(
            isArchived: archived ?? false,
            explicitName: name,
            ticket: Self.ticket(from: container),
        )
    }

    /// The title where there is one, else the flag saying the host was asked and had nothing. Two
    /// keys rather than one so a file written before the flag existed still reads as a title, and
    /// one value in memory so nothing can set the pair inconsistently.
    private static func ticket(
        from container: KeyedDecodingContainer<CodingKeys>,
    ) throws
        -> TicketReading? {
        if let title = try container.decodeIfPresent(String.self, forKey: .ticketTitle),
           let named = SessionAnnotations.name(from: title) {
            return .named(named)
        }
        let absent = try container.decodeIfPresent(Bool.self, forKey: .ticketAbsent)
        return absent == true ? .absent : nil
    }

    /// The name is written only when there is one: an explicit `null` beside every archived
    /// Session would be a record of a rename that never happened.
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(isArchived, forKey: .archived)
        try container.encodeIfPresent(explicitName, forKey: .name)
        try container.encodeIfPresent(ticket?.title, forKey: .ticketTitle)
        if ticket == .absent {
            try container.encode(true, forKey: .ticketAbsent)
        }
    }
}
