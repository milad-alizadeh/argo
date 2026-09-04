import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A mark, drawn as a rule with its words let into it.
///
/// The only hairlines in the feed are here: a rule ACROSS the column says the reading changed
/// shape at this point.
///
/// The words are machine type — the record talking about itself, not the agent. A mark with
/// nothing to say is the rule alone, running the whole column.
package struct FeedMarkLine: View {
    @Environment(\.argo) private var argo
    /// How this row reaches another Session. From the environment rather than threaded through the
    /// four views between here and the shell, exactly as `deckIsResizing` is.
    @Environment(\.argoOpenSession) private var openSession

    let mark: FeedMark

    /// `working` is drawn by `FeedWorkingThread` and never as a rule, because a rule with no words
    /// let into it is already how this view says a Turn ENDED. Routed here rather than at the
    /// caller, so every path to a mark takes the same fork.
    package var body: some View {
        switch mark {
        case .working: FeedWorkingThread()
        case .compacted, .turnEnded, .handedOff, .interrupted, .permissionExpired,
             .starting, .excerpted, .runFactChanged:
            punctuation
        }
    }

    private var punctuation: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            rule
            if let handoff = mark.handoff {
                link(to: handoff)
                rule
            } else if let words = mark.words {
                caption(words, in: wordInk)
                rule
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(mark.spoken)
    }

    /// The one mark that is a way out of the reading, in the ink this app spends on every other
    /// link (`FeedProseText`'s markdown links take it too).
    ///
    /// A caption-sized arrow rather than an underline: an underline at this size closes up against
    /// the descenders.
    private func link(to handoff: FeedHandoff) -> some View {
        Button { openSession(handoff.sessionID) } label: {
            HStack(spacing: ArgoSpacing.tight) {
                caption(mark.words ?? handoff.title, in: argo.color.interaction.accent)
                ArgoGlyph(ArgoSymbol.handedOff, .inline)
                    .foregroundStyle(argo.color.interaction.accent)
            }
        }
        .buttonStyle(.plain)
        .help("Open \(handoff.title), the Session this work was handed to")
    }

    /// The roster's attention amber for the one mark that reports an act rather than the shape of
    /// the record — the same colour the row wore while that prompt was waiting. Read off the mark,
    /// which is also where the minimap reads it; `nil` falls back to the caption's own tertiary.
    private var wordInk: ArgoColor? {
        mark.ink.state(in: argo.color)
    }

    private func caption(_ text: String, in ink: ArgoColor? = nil) -> some View {
        Text(text)
            .argoText(ArgoTypography.machineCaption)
            .monospacedDigit()
            .foregroundStyle(ink ?? argo.color.text.tertiary)
            .lineLimit(1)
            .fixedSize()
    }

    private var rule: some View {
        Rectangle()
            .fill(argo.color.edge.hairline)
            .frame(height: ArgoStroke.hairline)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(mark: FeedMark) {
        self.mark = mark
    }
}

// A turn's end is the rule alone, whatever reason the host reported for it (#1248).
#Preview("Marks — a turn that ended") {
    FeedMarkLine(mark: .turnEnded)
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
}

// The expiry against an ordinary mark rather than alone — the preview transcript carries no
// expiry, so this is the only place the two ever meet.
