import AppKit

/// The ladder as AppKit names it, for the surfaces that rasterise text into a `CGContext` rather
/// than composing a `Text` — the overview lane's Turn labels are the first of them.
///
/// Both frameworks read the HIG's own table, so a role set here and the same role set in SwiftUI
/// are the same size at the same Accessibility text setting. That is the whole reason this maps to
/// a semantic style rather than to `NSFont.systemFont(ofSize:)` and the rung's number.
extension ArgoTypeScale {
    var appKitStyle: NSFont.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .title1: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .body: .body
        case .callout: .callout
        case .subheadline: .subheadline
        case .footnote: .footnote
        case .caption1: .caption1
        case .caption2: .caption2
        }
    }

    /// What one line of this rung occupies AS DRAWN, off the face the platform resolves.
    ///
    /// Not `size * naturalLineHeightRatio`, which is a different number twice over: at `body` the
    /// product is 15.73 where TextKit sets the line at 17.31, and `size` is a constant where the
    /// resolved face is not, so the two part further once an Accessibility text setting moves the
    /// platform's ladder. `ArgoTextStyle.nominalLineBox` is that other number, under its own name.
    ///
    /// `@MainActor` is not the compiler's requirement — `preferredFont` is `nonisolated`. It is
    /// this repo's: the setting behind the answer is app-wide live state, and `ProseFace.font`
    /// already reads it from the main actor.
    @MainActor var drawnLineBox: CGFloat {
        let font = NSFont.preferredFont(forTextStyle: appKitStyle)
        return font.ascender - font.descender
    }
}
