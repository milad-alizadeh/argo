import Foundation

/// The on-disk shape, parsed at the boundary.
///
/// A record missing the fields that make it an identity is dropped while the rest of the file still
/// reads: one hand-edit gone wrong should not cost the machine every Account it has authorized,
/// each of which costs an OAuth round-trip to get back.
extension AccountRegistry: Codable {
    private enum CodingKeys: String, CodingKey {
        case accounts
    }

    /// Decodes a record, or nothing, without failing the array around it. `Decodable` has no other
    /// way to say "skip this element" — an unkeyed container that throws takes the whole file down.
    private struct LenientRecord: Decodable {
        let record: AccountRecord?

        init(from decoder: Decoder) throws {
            self.record = try? AccountRecord(from: decoder)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let lenient = try container.decodeIfPresent([LenientRecord].self, forKey: .accounts) ?? []
        self.init(accounts: lenient.compactMap(\.record))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(accounts, forKey: .accounts)
    }
}
