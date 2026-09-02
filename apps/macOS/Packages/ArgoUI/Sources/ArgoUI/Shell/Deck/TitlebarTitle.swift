import ArgoDesign
import SwiftUI

/// The Session's name where macOS puts a document title: the centre of the titlebar (#692).
///
/// Centred on the DETAIL PANE and never on the window, so it can never sit over the sidebar's
/// glass. `DeckCanopy` draws it, because the canopy IS that pane and already climbs into the bar.
///
/// It takes the pane's width rather than reading a geometry of its own, so the cap is a share of
/// the pane and not of whatever the title itself was given.
///
/// Everything the header's fact line and the tab line used to say out loud is on the hover
/// (`Header.tooltip`). The access posture is the one exception: a fact that gates what the composer
/// can do must not live only in a hover, so it is set beside the title in words.
package struct TitlebarTitle: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected. The item still holds its height: the bar's rhythm is the
    /// window's, not the Session's.
    let header: SessionHeaderProjection.Header?
    /// How wide the detail pane is right now, measured by the shell. Zero before the first layout,
    /// which draws the title unconstrained for one pass rather than at a width of nothing.
    var paneWidth: CGFloat = 0

    package var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            if let header {
                title(header)
                if let access = header.access {
                    posture(access)
                }
            }
        }
        // The cap goes on the PAIR, not on the title alone. The pair is what is centred, so a cap
        // on the title alone would let a posture word push the whole run past the share and carry
        // the title itself off the pane's midpoint.
        .frame(maxWidth: cap)
        // No height of its own: the caller gives it the strip's, and a title that set one would
        // fight the reach the canopy climbs by.
        .argoHelp(header?.tooltip)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(header?.announcement ?? "No Session selected")
    }

    /// Cut at the TAIL: a Session's title is written subject first, so its front tells two of them
    /// apart. It is the one thing in the run that gives — the posture word is four syllables and
    /// gating, so a cut there would be the wrong economy.
    private func title(_ header: SessionHeaderProjection.Header) -> some View {
        Text(header.title)
            .argoText(ArgoTypography.windowTitle)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            .truncationMode(.tail)
    }

    /// Whether the Session can be driven at all, in the same word the composer's foot uses. Which
    /// posture is worth a colour was decided by the projection.
    private func posture(_ access: SessionHeaderProjection.Header.AccessMark) -> some View {
        Text(access.word)
            .argoText(ArgoTypography.control)
            .foregroundStyle(access.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
    }

    /// What keeps the run clear of the scope vessel and the rooms capsule, pinned to opposite
    /// edges — it is centred, so the share is spent on BOTH sides of the pane's midpoint.
    ///
    /// `.infinity` before the shell has measured anything: a `maxWidth` of zero would collapse the
    /// title to nothing on the first pass rather than merely leave it uncut.
    private var cap: CGFloat {
        paneWidth > 0 ? paneWidth * ArgoLayout.titlebarTitleMaximumShare : .infinity
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(header: SessionHeaderProjection.Header?, paneWidth: CGFloat = 0) {
        self.header = header
        self.paneWidth = paneWidth
    }
}

private extension View {
    /// `.help` only where there is something to say. An empty help string still draws a chip, which
    /// reads as a fact that failed to load rather than as a Session nothing is known about — which
    /// is why `Header.tooltip` is optional rather than sometimes empty.
    @ViewBuilder func argoHelp(_ text: String?) -> some View {
        if let text {
            help(text)
        } else {
            self
        }
    }
}

// The width real titles are cut at.
