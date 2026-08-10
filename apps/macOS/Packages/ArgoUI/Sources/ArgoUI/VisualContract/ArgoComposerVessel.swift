import SwiftUI

/// The Session composer's own measurements. Each value is the approved study's
/// (`docs/designs/cockpit-session-composer.md`), taken from the decision log rather than from the
/// renders — values a token already owns are spelled through that token at the call site and are
/// deliberately not restated here.
public enum ArgoComposerVessel {
    /// The circle the send arrow sits in, and the attach control when an adapter carries one.
    public static let controlDiameter: CGFloat = 26

    /// The field's growth ceiling, in lines — the study's 132pt said in the unit the field
    /// actually grows by. Past it the field scrolls inside itself, so the feed above is never
    /// squeezed.
    public static let fieldLineCeiling = 6

    /// The scroll room under the feed's last row, so a reading never ends underneath the vessel.
    public static let feedClearance: CGFloat = 128

    /// The fade that lets the feed run under the vessel: opaque until 108pt off the bottom edge,
    /// clear from 28pt off it — spelled as the two heights a mask is stacked from.
    public static let feedFadeHeight: CGFloat = 80
    public static let feedClearHeight: CGFloat = 28

    /// The Permission prompt's target block past which the verbatim command or hunk scrolls
    /// inside itself — the study's 108pt. A ceiling and not a truncation: every character is
    /// reachable, because a decision made on a cut command is a guess.
    public static let targetCeiling: CGFloat = 108

    /// How tall an answer to a Permission stands, and how narrow it may get.
    ///
    /// Drawn rather than taken from a `controlSize`, because no rung the platform offers is the
    /// study's 27pt — `.small` renders 21 — and a decision the agent is blocked on is not a control
    /// to be crowded. The width is a floor and not a size: `Allow ⏎` and `Deny esc` are different
    /// lengths, and what has to hold is that neither reads as the smaller offer.
    public static let decisionHeight: CGFloat = 27
    public static let decisionMinimumWidth: CGFloat = 80

    /// How long the accent wash stands over a row the user just sent. A hold, not a motion —
    /// the fade in and out is `ArgoMotion.bloom` — which is why it lives beside the vessel's
    /// measurements rather than on the motion ramp with its half-second ceiling.
    public static let washHold: TimeInterval = 1.4
}
