import ArgoDesign
import Foundation

/// The rhythm the feed's own words are set at, as the numbers every measurement of them is taken
/// against.
///
/// Here rather than beside the feed's other measures because `ProseFace` needs them and this module
/// sits under the feed: a face reports a width and a line box in one breath, and the leading is
/// half of what a line box means. `ArgoFeedRow` names them still, and names these — one rhythm, so
/// the row and the ruler cannot come apart.
public enum ProseRhythm {
    /// The rung the feed's BODY is set on — prose and call lines alike. Markup keeps its own steps.
    public static let proseRung: ArgoTypeScale = .body

    /// The line height the body is set at.
    public static let lineHeight: CGFloat = 20

    /// The rung the feed's MONO is set on. The prose rung and not `ArgoTypography.machine`'s: the
    /// feed draws its mono as `.system(.body, design: .monospaced)`, which keeps the BODY's line
    /// box and changes only the advances, so the chrome role's `callout` is a box nothing in the
    /// feed stands in (#1026).
    public static let machineRung: ArgoTypeScale = proseRung

    /// What a line of output is set at, inside the evidence panel.
    public static let machineLineHeight: CGFloat = 18

    /// The extra leading that puts the body role on `lineHeight`. Floored at zero: a line height
    /// under the font's own is not something leading can express.
    ///
    /// Off the DRAWN box and not the ladder's nominal number, because leading is added to the box
    /// the platform resolves: the two differ at every rung by an amount with no fixed sign, so a
    /// line whose leading came off the nominal one stood over the height its name promises here and
    /// under it on another machine — #1026.
    @MainActor public static var proseLineSpacing: CGFloat {
        max(0, lineHeight - proseRung.drawnLineBox)
    }

    /// The same rhythm for machine output. Tighter than prose.
    @MainActor public static var machineLineSpacing: CGFloat {
        max(0, machineLineHeight - machineRung.drawnLineBox)
    }
}
