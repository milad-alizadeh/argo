import Foundation

/// The known set of Projects and which one the cockpit opens into.
///
/// Held as a value with every transition returning a new registry, so the store above it does
/// nothing but read one and write one — which is what keeps the rules below testable without a
/// filesystem in the way.
public struct ProjectRegistry: Equatable, Sendable {
    public let projects: [ProjectRecord]
    public let activeProjectID: String?

    public static let empty = ProjectRegistry(projects: [], activeProjectID: nil)

    /// An active id no record carries is normalised away here rather than at each reader: an
    /// unknown active Project is the same nothing as an unreadable registry.
    public init(projects: [ProjectRecord], activeProjectID: String?) {
        self.projects = projects
        self.activeProjectID = projects
            .contains { $0.id == activeProjectID } ? activeProjectID : nil
    }

    public var active: ProjectRecord? {
        project(id: activeProjectID)
    }

    public func project(id: String?) -> ProjectRecord? {
        projects.first { $0.id == id }
    }

    public func project(atPath path: String) -> ProjectRecord? {
        projects.first { $0.path == path }
    }

    /// Registration is the act that creates a Project, keyed on the resolved root: offering the
    /// same root again is a no-op rather than a second Project. The first one registered becomes
    /// active, so a first launch lands somewhere rather than nowhere.
    func registering(path: String) -> ProjectRegistry {
        guard project(atPath: path) == nil else { return self }
        let appended = projects + [ProjectRecord(id: UUID().uuidString, path: path)]
        return ProjectRegistry(
            projects: appended,
            activeProjectID: activeProjectID ?? appended.last?.id,
        )
    }

    /// Re-point a Project at where its folder now is. Keyed on the id, so the Project is the same
    /// one it was and nothing linked to it has to be rewritten.
    ///
    /// A root another Project already holds is refused rather than merged: one git root is one
    /// Project, and two records for it is the state the registry has no way back out of.
    func relocating(id: String, path: String) -> ProjectRegistry {
        guard project(atPath: path).map({ $0.id == id }) ?? true else { return self }
        return ProjectRegistry(
            projects: projects.map { $0.id == id ? ProjectRecord(id: id, path: path) : $0 },
            activeProjectID: activeProjectID,
        )
    }

    /// An id no record carries is left alone, and the caller reads the result back to learn whether
    /// the switch took.
    func activating(id: String) -> ProjectRegistry {
        guard projects.contains(where: { $0.id == id }) else { return self }
        return ProjectRegistry(projects: projects, activeProjectID: id)
    }
}
