import ArgoDesign
import ArgoEngine
import Foundation

/// The words an attachment is drawn with, derived off the value the way every other reading here
/// is: in a projection a test can hold still, rather than in a chip nobody diffs.
enum AttachmentProjection {
    /// The mono figure beside the name — `248 KB`, and ABSENT for a file whose size could not be
    /// read. A chip that said `Zero KB` would be reporting Argo's own gap as a fact about the file.
    /// `.binary` counts a kilobyte as 1024, which is the NUMBER the Finder's Get Info shows and the
    /// one the study's chips were measured against: `.file` renders the same screenshot as `254`
    /// where every other reading of it says `248`. The unit is spelled `kB` rather than the study's
    /// `KB` — that casing is the formatter's own, and hand-spelling it would put a raw string where
    /// a locale-aware value belongs.
    static func size(_ attachment: SessionAttachment) -> String? {
        guard attachment.byteCount > 0 else { return nil }
        return Int64(attachment.byteCount).formatted(.byteCount(style: .binary))
    }

    /// The mark a chip wears when it is not a picture, or when the bytes yield no thumbnail.
    ///
    /// The evidence panel's own language-family map, reused rather than restated — one mark per
    /// FAMILY, and the name beside it is what actually says which language. The study drew a
    /// generic `<>` on a `.swift` file because its HTML had no such map; the contract does, so a
    /// Swift file gets the Swift mark and the drift is toward the token rather than away from it.
    static func glyph(for attachment: SessionAttachment) -> String {
        if attachment.isImage {
            return ArgoSymbol.attachedImage
        }
        guard case let .file(url) = attachment.source,
              let language = EvidenceLanguage(declared: url.pathExtension)
        else { return ArgoSymbol.attachedFile }
        return language.symbol
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
