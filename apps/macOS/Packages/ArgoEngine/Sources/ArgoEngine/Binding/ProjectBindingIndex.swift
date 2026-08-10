import Foundation

/// Who is using an Account, answered from the Project registry — where Bindings actually live.
///
/// This is what `NoAccountBindings` stood in for while nothing on the machine could bind anything.
/// It was replaced rather than corrected, which is the point of having written it as a real empty
/// answer: the day Bindings exist, the honest answer is a different type.
///
/// The arrow still points this way. `AccountRegistryStore` asks a question and is handed an answer;
/// it never learns that Bindings are kept in `projects.json`, and removing an Account never writes
/// to the Project registry — a Binding whose Account has gone is reported, and re-pointing it is a
/// choice only the user makes (`AccountRemoval`).
public struct ProjectBindingIndex: AccountBindingIndex {
    private let projects: ProjectRegistryStore

    public init(projects: ProjectRegistryStore) {
        self.projects = projects
    }

    public func bindings(referencing accountID: String) async -> [AccountBindingReference] {
        await projects.load().projects.flatMap { project in
            project.bindings
                .filter { $0.accountID == accountID }
                .map { AccountBindingReference(projectID: project.id, port: $0.port) }
        }
    }
}
