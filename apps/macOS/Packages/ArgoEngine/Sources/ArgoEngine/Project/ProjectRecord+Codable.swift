import Foundation

/// The on-disk shape of one Project.
///
/// Written by hand rather than synthesised for one reason: `bindings` has to be **optional on the
/// way in and always present on the way out**. Every `projects.json` written before Bindings
/// existed carries no such key, and the synthesised decode would fail on all of them — which
/// `ProjectRegistry`'s lenient array turns into a machine that silently forgets every Project it
/// had. A registry that upgrades is the difference between adding a field and a migration.
extension ProjectRecord: Codable {
    private enum CodingKeys: String, CodingKey {
        case id
        case path
        case bindings
    }

    /// A binding that does not decode is dropped while the Project around it still reads, the same
    /// bargain `ProjectRegistry` strikes for a record: an unreadable Binding leaves the port
    /// unbound, which is a state the cockpit already renders honestly, and is recoverable by
    /// binding it again.
    private struct LenientBinding: Decodable {
        let binding: ProjectBinding?

        init(from decoder: Decoder) throws {
            self.binding = try? ProjectBinding(from: decoder)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let lenient = try container.decodeIfPresent([LenientBinding].self, forKey: .bindings) ?? []
        try self.init(
            id: container.decode(String.self, forKey: .id),
            path: container.decode(String.self, forKey: .path),
            bindings: lenient.compactMap(\.binding),
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(path, forKey: .path)
        try container.encode(bindings, forKey: .bindings)
    }
}
