import SwiftUI

/// The box an icon-only button is drawn in — the settled half of what `ArgoIconSize` began. The
/// glyph scale says how large the MARK is; this says how large the CONTROL round it is, which is
/// what a pointer aims at and what a row of headers is judged by.
///
/// ONE box and no rung ladder. Four surfaces measured their own (26 x 24, 36, 26, 24) and the same
/// mark read as a different control from one header to the next (#1243). A second rung would have
/// to name a surface where an icon button means something different, and there is none.
///
/// A surface may still draw its own box, but only where the number answers to something other than
/// the button — `ArgoFeedRow.tailDiameter` answers to the lane it shares with the plan pill. Such a
/// number stays beside its surface, with the reason in its doc comment.
public enum ArgoControlBox {
    /// The drawn box. A SQUARE, so a mark stands the same distance from every edge of the control
    /// it sits in. The 26 x 24 slot it replaces was two points narrower than it was tall, which
    /// nothing but a capsule's end cap ever asked for — and the vessel's inset below is what
    /// actually answers that.
    ///
    /// A DRAWN box and not a hit target. `ArgoLayout.controlHitTarget` (24) is the invisible square
    /// laid over a small mark that is not a control of its own; this one is painted, takes a ground
    /// and carries the press. A 24pt clear square over a 13pt chevron and a 26pt button round a
    /// 13pt mark are different things, and neither number may be read as the other.
    public static let icon: CGFloat = 26

    /// The padding a vessel puts round the buttons it groups. It belongs to the VESSEL and not to
    /// the button inside it: spent as button padding, a lone icon in a vessel of its own drew a
    /// capsule a third wider than one holding two.
    public static let vesselInset: CGFloat = 5

    /// The box of a button that carries its OWN container — the shell row's New Session, which
    /// stands beside the toolbar's other containers rather than inside one.
    ///
    /// DERIVED, and that is the whole point: a lone icon in a container is the box plus the same
    /// inset a group spends, so it stands exactly as tall as a capsule holding three. It is not a
    /// second rung, and nothing may set it by hand — the shell's band height
    /// (`ArgoToolbarVessel.height`) reads this rather than naming 36 a second time.
    public static var vessel: CGFloat {
        icon + vesselInset * 2
    }

    /// Between two buttons sharing one vessel. Tighter than any rung of `ArgoSpacing`, and
    /// deliberately: these are segments of one control, not two controls side by side.
    public static let vesselGap: CGFloat = ArgoSpacing.hair

    /// The rule between the segments of one vessel. Shorter than the box, so it parts the marks
    /// without reaching the inset and cutting the capsule across.
    public static let vesselRuleHeight: CGFloat = 15
}
