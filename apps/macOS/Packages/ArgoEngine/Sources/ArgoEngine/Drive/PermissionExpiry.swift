import Foundation

/// A Permission that ended without anybody answering it, and that Argo itself ended (#573).
///
/// DIRECT and managed-only, like the `PermissionRequest` it ends: Argo held the clock that ran
/// out, so this is Argo reporting its own act rather than inferring one. That is the whole
/// reason the record exists — the call was refused and NOBODY refused it, so a feed that said
/// `denied` alone would credit a decision no person made, and one that said nothing at all would
/// leave a tool call with no account of what became of it.
///
/// A prompt that goes because the user cancelled the turn it belonged to produces none of these. It
/// is not this: a prompt vanishing with the turn it was raised in is the expected answer, and the
/// hook simply going is indistinguishable from it. Only Argo's own clock firing is.
public struct PermissionExpiry: Sendable, Equatable, Identifiable {
    /// The Permission's own id, kept: a Session can expire more than one call, and the record of
    /// what happened has to be as addressable as the prompt it replaces.
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
