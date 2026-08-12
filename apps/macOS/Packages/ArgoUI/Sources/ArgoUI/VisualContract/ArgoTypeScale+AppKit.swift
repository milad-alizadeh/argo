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
}
