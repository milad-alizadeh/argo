import Foundation

/// The registered set as the Project menu's items, so the menu's honesty claims are values rather
/// than view code: an unreachable Project keeps its place and states it in words, and a Project
/// nothing has observed carries no count rather than a zero.
///
/// A menu row is ONE line of text, which is what `title` is for — the same constraint `ModeMenu`
/// answers with an em dash, answered the same way. The folder is not on it: a path in a menu row is
/// the diagnostic table D30 took off the roster, and `Reveal in Finder` is where it belongs.
enum ProjectMenuProjection {
    /// The words that replace a path when the folder is not where it was registered. Never a
    /// colour or a dashed edge alone — those are the second reading of this, not the first.
    static let unreachable = "folder not found"

    struct Row: Identifiable, Sendable {
        let id: String
        let name: String
        /// The whole menu line: the name, and what qualifies it where anything does.
        let title: String
        let isReachable: Bool
        /// A row nobody registered carries no management verbs: there is no record to reveal,
        /// re-point or forget.
        let isRegistered: Bool
        let isActive: Bool
        /// Everything the row states, spoken. State is never left to the row's shape.
        let accessibilityLabel: String
    }

    static func rows(from presentation: CockpitPresentation) -> [Row] {
        presentation.projects.map { project in
            Row(
                id: project.id,
                name: project.name,
                title: title(for: project),
                isReachable: project.isReachable,
                isRegistered: project.isRegistered,
                isActive: project.id == presentation.activeProjectID,
                accessibilityLabel: label(for: project),
            )
        }
    }

    /// Which Project the menu opens ticked. `nil` where nothing is registered, which is also the
    /// one state that draws no items at all.
    static func active(in rows: [Row]) -> Row.ID? {
        rows.first(where: \.isActive)?.id
    }

    /// The count wins over the folder when a Project has both to say: what is LIVE in it is why a
    /// reader opened this menu, and an unreachable Project has nothing live in it anyway.
    private static func title(for project: CockpitPresentation.Project) -> String {
        guard project.isReachable else { return "\(project.name) — \(unreachable)" }
        guard let count = project.liveSessionCount else { return project.name }
        return "\(project.name) — \(count) live"
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
