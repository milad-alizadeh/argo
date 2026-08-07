import Foundation

enum SessionRosterProjection {
    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        let model: String
        let workspaceIdentity: String
        let location: String?
        let branch: String?
        let isReadOnly: Bool
        let state: ArgoOperationalState?

        var metadata: String {
            "\(model) · \(workspaceIdentity)"
        }

        var stateWord: String? {
            guard !isReadOnly else { return nil }
            return switch state {
            case .running: "running"
            case .idle: "idle"
            case .attention: "needs you"
            case .failure: "failed"
            case nil: nil
            }
        }
    }

    static func rows(from sessions: [CockpitPresentation.Session]) -> [Row] {
        let identities = workspaceIdentities(for: sessions.map(\.workspaceLocation))
        return zip(sessions, identities).map { session, identity in
            Row(
                id: session.id,
                title: session.title,
                model: session.model ?? "unknown",
                workspaceIdentity: identity,
                location: session.workspaceLocation,
                branch: session.branch,
                isReadOnly: session.access == .readOnly,
                state: session.operationalState,
            )
        }
    }

    private static func workspaceIdentities(for locations: [String?]) -> [String] {
        let components = locations.map(pathComponents)
        return components.enumerated().map { index, path in
            guard let name = path.last else { return "unknown" }
            let matches = components.indices.filter { components[$0].last == name }
            guard matches.count > 1 else { return name }
            return shortestUniqueSuffix(at: index, among: matches, paths: components)
        }
    }

    private static func pathComponents(_ location: String?) -> [String] {
        guard let location else { return [] }
        return URL(fileURLWithPath: location).standardizedFileURL.pathComponents
            .filter { $0 != "/" }
    }

    private static func shortestUniqueSuffix(
        at index: Int,
        among matches: [Int],
        paths: [[String]],
    )
        -> String {
        let path = paths[index]
        guard path.count > 1 else { return path.last ?? "unknown" }
        if matches.allSatisfy({ paths[$0] == path }) {
            return path.last ?? "unknown"
        }
        for count in 2 ... path.count {
            let candidate = path.suffix(count)
            if matches.allSatisfy({ $0 == index || paths[$0].suffix(count) != candidate }) {
                return candidate.joined(separator: "/")
            }
        }
        return path.joined(separator: "/")
    }
}
