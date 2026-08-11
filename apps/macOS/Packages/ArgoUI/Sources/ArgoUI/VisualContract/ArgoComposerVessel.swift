import SwiftUI

/// The Session composer's own measurements, each from the approved study
/// (`docs/designs/cockpit-session-composer.md`). Values a token already owns are spelled through
/// that token at the call site and are not restated here.
public enum ArgoComposerVessel {
    /// The circle the send arrow sits in, and the attach control when an adapter carries one.
    public static let controlDiameter: CGFloat = 26

    /// The field's growth ceiling, in lines — the study's 132pt said in the unit the field
    /// actually grows by. Past it the field scrolls inside itself, so the feed above is never
    /// squeezed.
    public static let fieldLineCeiling = 6

    /// How tall a queued follow-up stands — the study's 30pt, and deliberately NOT `chipHeight`.
    /// A chip holds a name and this holds a sentence: at 20pt the row reads as a token that
    /// overflowed rather than as a message waiting to go.
    public static let queuedTurnHeight: CGFloat = 30

    /// The scroll room under the feed's last row, so a reading never ends underneath the vessel.
    public static let feedClearance: CGFloat = 128

    /// The fade that lets the feed run under the vessel: opaque until 108pt off the bottom edge,
    /// clear from 28pt off it — spelled as the two heights a mask is stacked from.
    public static let feedFadeHeight: CGFloat = 80
    public static let feedClearHeight: CGFloat = 28

    /// The Permission prompt's target block past which the verbatim command or hunk scrolls
    /// inside itself — the study's 108pt. A ceiling and not a truncation: every character stays
    /// reachable.
    public static let targetCeiling: CGFloat = 108

    /// How tall an answer to a Permission stands, and how narrow it may get. Drawn rather than
    /// taken from a `controlSize`: no rung the platform offers is the study's 27pt — `.small`
    /// renders 21. The width is a floor, since `Allow ⏎` and `Deny esc` are different lengths.
    public static let decisionHeight: CGFloat = 27
    public static let decisionMinimumWidth: CGFloat = 80

    /// How tall a chip above the field stands — an attachment, or a standing allow (#572). Fixed
    /// rather than left to its content, because the chips wrap: a run seated on its own text
    /// heights gives every line a different measure, and a label beside them no baseline to take.
    public static let chipHeight: CGFloat = 20

    /// How wide the NAME on such a chip may get before it truncates. A ceiling and not a width:
    /// `Bash` takes what it needs. It exists because an MCP tool is named
    /// `mcp__server__the_verb`, and one of those unchecked is a chip as wide as the vessel.
    public static let chipNameCeiling: CGFloat = 160

    /// How long the accent wash stands over a row the user just sent. A hold, not a motion — the
    /// fade in and out is `ArgoMotion.bloom`, whose ramp has a half-second ceiling.
    public static let washHold: TimeInterval = 1.4
}
