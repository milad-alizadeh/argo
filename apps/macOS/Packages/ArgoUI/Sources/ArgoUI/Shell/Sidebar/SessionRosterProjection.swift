import Foundation

enum SessionRosterProjection {
    /// The word every tier-gated fact degrades to. One spelling, because a roster that says
    /// "unknown" in one column and something else in the next reads as two different claims.
    static let unknown = "unknown"

    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        let model: String
        let workspaceIdentity: String
        let location: String?
        let branch: String?
        /// Always true of an observed Session, and always announced. Only the *glyph* is
        /// conditional, so hiding it never hides the fact.
        let isReadOnly: Bool
        /// The lock is drawn only when read-only tells the rows apart.
        let showsLock: Bool
        let state: ArgoOperationalState?

        var metadata: String {
            "\(model) · \(workspaceIdentity)"
        }

        /// The dot carries `running` and `idle`; a word is spent only where the roster needs
        /// the user to stop scanning. D30 keeps counts and words to what helps the scan.
        var stateWord: String? {
            switch state {
            case .attention: "Needs you"
            case .failure: "Failed"
            case .running, .idle, nil: nil
            }
        }
    }

    static func rows(from sessions: [CockpitPresentation.Session]) -> [Row] {
        let identities = workspaceIdentities(for: sessions.map(\.workspaceLocation))
        let access = sessions.map(\.access)
        let locksDistinguish = access.contains(.readOnly) && access.contains(.managed)
        return zip(sessions, identities).map { session, identity in
            Row(
                id: session.id,
                title: session.title,
                model: session.model ?? unknown,
                workspaceIdentity: identity,
                location: session.workspaceLocation,
                branch: session.branch,
                isReadOnly: session.access == .readOnly,
                showsLock: locksDistinguish && session.access == .readOnly,
                state: session.operationalState,
            )
        }
    }

    private static func workspaceIdentities(for locations: [String?]) -> [String] {
        let components = locations.map(pathComponents)
        return components.enumerated().map { index, path in
            guard let name = path.last else { return unknown }
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

    /// The parent qualifier is capped at one, so the label can never grow into the path it
    /// is standing in for — "absolute paths never appear in the default presentation" (#377).
    /// Where that leaves two Sessions reading alike, they read alike: hover and the copy
    /// actions carry the full location, which is the disclosure D30 asks for.
    private static let identityDepth = 2

    private static func shortestUniqueSuffix(
        at index: Int,
        among matches: [Int],
        paths: [[String]],
    )
        -> String {
        let path = paths[index]
        guard let name = path.last else { return unknown }
        // An exact twin is not a rival: no label separates two Sessions on one location, and
        // treating it as one is what used to push the qualifier out to the whole path.
        let rivals = matches.filter { $0 != index && paths[$0] != path }
        guard !rivals.isEmpty, path.count > 1 else { return name }
        for count in 2 ... min(path.count, identityDepth) {
            let candidate = path.suffix(count)
            if rivals.allSatisfy({ paths[$0].suffix(count) != candidate }) {
                return candidate.joined(separator: "/")
            }
        }
        return path.suffix(identityDepth).joined(separator: "/")
    }
}
