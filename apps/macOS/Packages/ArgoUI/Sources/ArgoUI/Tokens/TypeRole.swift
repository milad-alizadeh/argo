import SwiftUI

/// One sans ladder at 10/12/14/16 (+19 display, +23 hero), every step 2px. This ladder IS
/// the cockpit's density: it is the Penumbra prototypes' own measure, decided here rather
/// than deferred per surface.
///
/// All further hierarchy is carried inside a size — by weight, by case and tracking, or by
/// line height — never by a 1px size step. The half-steps the prototypes explored in are
/// jitter and do not exist in the contract: a new size snaps to a role, or is promoted here.
///
/// Weights run LIGHT. 400 is the baseline and only `rowStrong` reaches past it: at these
/// sizes a dense row set at 600 does not read as structure, it reads as shouting.
///
/// **Typeface.** The Electron cockpit bundles Inter; this app is on the system face until
/// Inter is added to the app bundle. Sizes, weights, leading and tracking are the contract's
/// and are already correct — only the family is provisional.
public struct TypeRole: Sendable {
    public let size: CGFloat
    public let leading: CGFloat
    public let weight: Font.Weight
    /// Tracking in ems, as the contract states it. Converted against `size` on use.
    public let tracking: CGFloat
    public let isMonospaced: Bool

    init(
        size: CGFloat,
        leading: CGFloat,
        weight: Font.Weight,
        tracking: CGFloat,
        isMonospaced: Bool = false,
    ) {
        self.size = size
        self.leading = leading
        self.weight = weight
        self.tracking = tracking
        self.isMonospaced = isMonospaced
    }

    public var font: Font {
        isMonospaced
            ? .system(size: size, weight: weight, design: .monospaced)
            : .system(size: size, weight: weight)
    }

    /// SwiftUI adds line SPACING between lines rather than setting a line BOX, so the
    /// contract's leading becomes the gap left over once the glyphs have taken their height.
    public var lineSpacing: CGFloat {
        max(0, leading - size)
    }
}

public extension TypeRole {
    /// A screen's own title: a ticket's hero line, a stage heading, a rendered h1. Light
    /// weight rather than bold — at this size the quiet is carried by the stroke.
    static let hero = TypeRole(size: 23, leading: 28, weight: .ultraLight, tracking: 0.01)

    /// A plane's OWN name, set as a display line rather than as the first row of a list.
    /// Never a list row, never a section head.
    static let display = TypeRole(size: 19, leading: 24, weight: .ultraLight, tracking: 0.01)

    /// Verdict hero, session-level headings.
    static let headline = TypeRole(size: 16, leading: 21, weight: .regular, tracking: -0.01)

    /// The now-line; a panel's or plane's single hero row.
    static let title = TypeRole(size: 14, leading: 19, weight: .regular, tracking: -0.005)

    /// List primary text.
    static let row = TypeRole(size: 12, leading: 17, weight: .regular, tracking: 0)

    /// Same size as `row` — weight differentiates. Row titles, buttons.
    static let rowStrong = TypeRole(size: 12, leading: 17, weight: .medium, tracking: 0)

    /// Same size as `row` — leading differentiates. Multi-line reading.
    static let prose = TypeRole(size: 12, leading: 19, weight: .regular, tracking: 0)

    /// Timestamps, counts, key/value keys. Pair with tabular figures.
    static let meta = TypeRole(size: 10, leading: 15, weight: .regular, tracking: 0.02)

    /// State chips and severity words, set uppercase. Same SIZE as `meta` on purpose: a
    /// status word and the model/branch line under it are one tier, and a tag set a step
    /// below made the state read as a footnote to its own metadata. Case and tracking are
    /// what separate the two roles; size is not.
    static let tag = TypeRole(size: 10, leading: 15, weight: .medium, tracking: 0.14)

    /// Section headers, set uppercase.
    static let eyebrow = TypeRole(size: 10, leading: 13, weight: .regular, tracking: 0.22)

    /// Terminal, diff hunks, code blocks.
    static let code = TypeRole(
        size: 12,
        leading: 19,
        weight: .regular,
        tracking: 0,
        isMonospaced: true,
    )

    /// The one deliberately off-ladder size: mono renders about a pixel larger than sans at
    /// the same value, so an inline path or SHA inside a `row` is set a step down to match it
    /// optically. Never a starting point for a new size.
    static let codeInline = TypeRole(
        size: 11,
        leading: 17,
        weight: .regular,
        tracking: 0,
        isMonospaced: true,
    )
}

public extension View {
    /// Every rendered string goes through a role. A bare `Text` with no role is the Swift
    /// form of an untokenized size (rules/swift-style.md).
    func typeRole(_ role: TypeRole) -> some View {
        font(role.font)
            .tracking(role.tracking * role.size)
            .lineSpacing(role.lineSpacing)
    }
}
