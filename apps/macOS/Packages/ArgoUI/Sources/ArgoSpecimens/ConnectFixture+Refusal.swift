import ArgoEngine
import ArgoUI

/// The Connect panel under a refusal the PROVIDER worded (#1045). Beside the other readings rather
/// than among them: their enum is at its body ceiling, and this is one subject of its own.
extension ConnectFixture {
    /// Long enough that the middle line is the provider's first line and no more. What the render
    /// has to settle is that the gesture under the three lines reads as the way to the rest of it
    /// rather than as a fourth sentence.
    static let refusedAtLength = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        note: ConnectNote(
            deviceFlow: .refused(
                code: "access_denied",
                description: """
                Your organisation blocks OAuth Apps that request repo access.
                An owner can approve Argo under Settings → Third-party access.
                """,
            ),
            provider: .github,
        ),
    )
}
