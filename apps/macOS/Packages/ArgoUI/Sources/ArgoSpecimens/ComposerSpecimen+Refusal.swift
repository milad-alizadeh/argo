import ArgoUI
import Foundation

/// The seam's refusal in words nobody at Argo wrote (#1045). Beside the other drafts rather than
/// among them because this one is BUILT — a refusal carrying output is one a port raised, so the
/// fixture raises one.
extension ComposerSpecimen {
    /// More words than the seam's one line holds: the state §5's gesture exists for. What the port
    /// printed is the only text that says what to change, and the render has to settle that the way
    /// to it sits between the line and Retry without reading as a second remedy.
    static var refusedAtLength: ComposerDraft {
        var draft = ComposerDraft(text: "Carry on with the plan.")
        draft.send(via: { _, _ in throw PortRefusal() })
        return draft
    }

    /// A refusal from outside Argo's own vocabulary, which is the only kind that carries output.
    /// Internal so the suites raise the SAME words the render is judged against.
    struct PortRefusal: LocalizedError {
        var errorDescription: String? {
            """
            The adapter would not take that Turn.
            hint: the last one is still being written, and this adapter takes one at a time
            """
        }
    }
}
