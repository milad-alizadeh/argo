import Foundation

/// A Permission that ended without anybody answering it, and that Argo itself ended (#573).
///
/// DIRECT and managed-only, like the `PermissionRequest` it ends: Argo held the clock that ran
/// out, so this is Argo reporting its own act rather than inferring one — the call was refused and
/// NOBODY refused it.
///
/// A prompt that goes because the user cancelled the turn produces none of these: the hook simply
/// going is indistinguishable from that. Only Argo's own clock firing makes one.
public struct PermissionExpiry: Sendable, Equatable, Identifiable {
    /// The Permission's own id, kept: a Session can expire more than one call.
    public let id: String
    /// The CLI's own name for the tool that was asking, verbatim.
    public let toolName: String

    public init(id: String, toolName: String) {
        self.id = id
        self.toolName = toolName
    }

    init(_ request: PermissionRequest) {
        self.init(id: request.id, toolName: request.toolName)
    }
}
