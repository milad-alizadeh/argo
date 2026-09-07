import Foundation

/// What one claim's gate hands the spawn that will dial it: where the socket is, and how long the
/// hook may wait to be told the gate is holding its question.
///
/// Both together rather than a path alone, because a hook told where to dial and not how long to
/// wait for an answer to that dial is exactly the hook that waits forever (#1553).
struct PermissionGrant {
    let socketPath: String
    let acknowledgementSeconds: Int
}
