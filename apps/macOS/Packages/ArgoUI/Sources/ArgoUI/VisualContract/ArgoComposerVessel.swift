import SwiftUI

/// The Session composer's own measurements, each from the approved study
/// (`docs/designs/cockpit-session-composer.md`). Values a token already owns are spelled through
/// that token at the call site and are not restated here.
public enum ArgoComposerVessel {
    /// The circle the send arrow sits in, and the attach control when an adapter carries one.
    public static let controlDiameter: CGFloat = 26

    /// The stop mark inside that circle while a Turn runs (#541) — a quarter of the disc it sits
    /// in, measured off `docs/designs/composer/running.png`.
    ///
    /// A drawn square rather than a rung of the icon scale, because no rung is this small: `inline`
    /// (10) is the floor and the study's mark is 7. It is the one mark in the shell that is a SHAPE
    /// and not a symbol, and that is the honest reading of it — there is nothing to recognise in a
    /// stop square, only a size. A solid at the send arrow's own rung fills half the disc and reads
    /// as a second button inside the first.
    public static let stopMark: CGFloat = 7

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

    /// The box on one option of a many-of ask (#712). A TARGET and not a mark: the tick inside it
    /// rides the icon scale at `inline`, and this is the box a pointer has to find.
    ///
    /// Between `ArgoIconSize.inline` (10), which is too small to aim at, and
    /// `chipDismissDiameter` (18), which is a control's whole hit area rather than a box drawn
    /// beside a label. Only a many-of question draws one: a one-of question is answered by the
    /// click itself and has nothing to tick.
    public static let askBoxSize: CGFloat = 14

    /// The `×` on an attachment's chip — the study's 18pt (#540). A target and not a mark: the
    /// glyph inside it rides the icon scale, and this is the box a pointer has to find. Larger than
    /// the chip it sits in is impossible and smaller than a finger's worth is useless, which is the
    /// whole range the number lives in.
    public static let chipDismissDiameter: CGFloat = 18

    /// The picture on an attachment's chip — the study's "20pt leading thumbnail (images)" (#540).
    public static let attachmentThumbnail: CGFloat = 20

    /// How tall an attachment's chip stands: the thumbnail with `ArgoSpacing.tight` above and below
    /// it, which is the study's 28 and the row its token reconciliation snapped `3px` to.
    ///
    /// Derived rather than restated, because the derivation is the whole reason for the number — a
    /// chip seated at the thumbnail's own height (which this was, until `/pixel-review` measured
    /// the approved render) draws a picture flush to three of its edges and reads as an image that
    /// overflowed its container. Deliberately NOT `chipHeight`: a standing allow holds a word and
    /// this holds a picture, and #572's tray was approved at 20.
    public static let attachmentChipHeight = attachmentThumbnail + ArgoSpacing.tight * 2

    /// How wide the NAME on such a chip may get before it truncates. A ceiling and not a width:
    /// `Bash` takes what it needs. It exists because an MCP tool is named
    /// `mcp__server__the_verb`, and one of those unchecked is a chip as wide as the vessel.
    public static let chipNameCeiling: CGFloat = 160

    /// How tall the Mode control stands, measured off `docs/designs/composer/rest.png`. It has no
    /// width: the control hugs the selected rung. Not `chipHeight`, though the two agree today.
    public static let modeHeight: CGFloat = 20

    /// How tall the line standing in for a composer that cannot reach anything is (#546), measured
    /// off `docs/designs/composer/orphaned.png`. A row at the deck's foot rather than a vessel over
    /// the feed: nothing floats here, because there is nothing under it to look through to.
    public static let unavailableHeight: CGFloat = 48

    /// How long the accent wash stands over a row the user just sent. A hold, not a motion — the
    /// fade in and out is `ArgoMotion.bloom`, whose ramp has a half-second ceiling.
    public static let washHold: TimeInterval = 1.4
}
