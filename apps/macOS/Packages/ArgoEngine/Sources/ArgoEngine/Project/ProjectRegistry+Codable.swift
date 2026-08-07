import Foundation

/// The on-disk shape, parsed at the boundary.
///
/// A record without an id and a path is not a Project and is dropped, while the rest of the file
/// still reads: one hand-edit gone wrong should not cost the machine every Project it knows.
extension ProjectRegistry: Codable {
    private enum CodingKeys: String, CodingKey {
        case projects
        case activeProjectID = "activeProjectId"
    }

    /// Decodes a record, or nothing, without failing the array around it. `Decodable` has no other
    /// way to say "skip this element" — an unkeyed container that throws takes the whole file down.
    private struct LenientRecord: Decodable {
        let record: ProjectRecord?

        init(from decoder: Decoder) throws {
            self.record = try? ProjectRecord(from: decoder)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let lenient = try container.decodeIfPresent([LenientRecord].self, forKey: .projects) ?? []
        let activeProjectID = try container.decodeIfPresent(String.self, forKey: .activeProjectID)
        self.init(projects: lenient.compactMap(\.record), activeProjectID: activeProjectID)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(projects, forKey: .projects)
        try container.encode(activeProjectID, forKey: .activeProjectID)
    }
}
