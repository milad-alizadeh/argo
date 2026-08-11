import ArgoEngine
import Foundation

/// The words an attachment is drawn with, derived off the value the way every other reading here
/// is: in a projection a test can hold still, rather than in a chip nobody diffs.
enum AttachmentProjection {
    /// The mono figure beside the name — `248 KB`, and ABSENT for a file whose size could not be
    /// read. A chip that said `Zero KB` would be reporting Argo's own gap as a fact about the file.
    /// `.binary` counts a kilobyte as 1024 and still spells it `KB`, which is what the Finder's Get
    /// Info shows and what the study's chips were measured against — `.file` renders the same
    /// screenshot as `254 kB`, a number the reader would have to reconcile with the one their own
    /// machine gives them.
    static func size(_ attachment: SessionAttachment) -> String? {
        guard attachment.byteCount > 0 else { return nil }
        return Int64(attachment.byteCount).formatted(.byteCount(style: .binary))
    }

    /// What the `×` says to a screen reader, and what its tooltip carries. The name in full, since
    /// the chip itself may have ellipsized it.
    static func removal(_ attachment: SessionAttachment) -> String {
        "Remove \(attachment.name)"
    }

    /// What the vessel reads while something is held over it. Four words on the study's wash, and
    /// the only sentence a drag-over draws — the rim says the rest.
    static let dropTarget = "Drop to attach"

    /// What the `+` says. A control with no word on it needs one somewhere, and the tooltip and the
    /// screen reader take the same sentence rather than two half-descriptions of one act.
    static let attach = "Attach a file"
}
