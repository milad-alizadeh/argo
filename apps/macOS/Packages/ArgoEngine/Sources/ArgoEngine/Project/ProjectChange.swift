import Foundation

/// The registry after a change, and the Project the change was about.
///
/// The caller needs both, and it cannot derive the second from the first: the store keys a Project
/// on the **resolved git root**, so a caller holding only the folder it offered has no way to find
/// the record that folder became. `project` is absent when the change was refused.
public struct ProjectChange: Equatable, Sendable {
    public let registry: ProjectRegistry
    public let project: ProjectRecord?

    public init(registry: ProjectRegistry, project: ProjectRecord?) {
        self.registry = registry
        self.project = project
    }
}
