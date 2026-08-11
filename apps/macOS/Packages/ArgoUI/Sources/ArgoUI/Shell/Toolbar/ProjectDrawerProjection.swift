import Foundation

/// The registered set as the drawer's rows, so the drawer's honesty claims are values rather than
/// view code: an unreachable Project keeps its place and states it in words, and a Project nothing
/// has observed carries no count rather than a zero.
enum ProjectDrawerProjection {
    /// The words that replace a path when the folder is not where it was registered. Never a
    /// colour or a dashed edge alone — those are the second reading of this, not the first.
    static let unreachable = "folder not found"

    struct Row: Identifiable, Sendable {
        let id: String
        let name: String
        /// The folder, or `unreachable` in its place.
        let detail: String
        let isReachable: Bool
        /// A row nobody registered carries no management verbs: there is no record to reveal,
        /// re-point or forget.
        let isRegistered: Bool
        let isActive: Bool
        /// The compact count the row draws, absent where nothing has observed this Project.
        let liveSessions: String?
        /// Everything the row states, spoken. State is never left to the row's shape.
        let accessibilityLabel: String
    }

    static func rows(from presentation: CockpitPresentation) -> [Row] {
        presentation.projects.map { project in
            Row(
                id: project.id,
                name: project.name,
                detail: project.isReachable ? project.location : unreachable,
                isReachable: project.isReachable,
                isRegistered: project.isRegistered,
                isActive: project.id == presentation.activeProjectID,
                liveSessions: project.liveSessionCount.map { "\($0) live" },
                accessibilityLabel: label(for: project),
            )
        }
    }

    private static func label(for project: CockpitPresentation.Project) -> String {
        let state = project.isReachable ? nil : unreachable
        let sessions = project.liveSessionCount.map(spelled(liveSessions:))
        return (["Project", project.name] + [state, sessions].compactMap(\.self))
            .joined(separator: ", ")
    }

    private static func spelled(liveSessions count: Int) -> String {
        switch count {
        case 0: "no live Sessions"
        case 1: "1 live Session"
        default: "\(count) live Sessions"
        }
    }
}
