import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// A call, drawn as one line of type with a mark on it.
///
/// One line at any window width, and one line WHATEVER happened. How it went is said in the ink of
/// the whole line and a mark after it — never in words. The record's own account of a failure is
/// the panel's, whole.
///
/// Every part of the sentence is set on ONE rung, interface and mono alike.
package struct FeedCallLine: View {
    @Environment(\.argo) private var argo

    let call: FeedCall
    /// Whether this row's evidence is what the panel is showing. The opened row keeps its
    /// ground, so a panel full of output still says which line it came from.
    let isOpen: Bool
    let open: () -> Void

    package var body: some View {
        Button(action: open) {
            sentence
        }
        .buttonStyle(FeedRowButtonStyle(isOpen: isOpen))
        .disabled(call.disclosure == .none)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(call.spoken)
        .accessibilityHint(call.disclosure == .available ? "Opens what this call produced" : "")
    }

    /// The chevron sits OUTSIDE the lit run: it says the row can be opened, which is as true of a
    /// call still running as of one that finished, so the ion has no business crossing it.
    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            lit
            disclosure
        }
        .lineLimit(1)
    }

    /// Everything the ion crosses, as one run of type — see `FeedCallLineIon` for why it is one
    /// surface and not six.
    private var lit: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(call.kind.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(verdict ?? restInk)
            FeedCallSubject(subject: call.subject, tint: verdict, isOpen: isOpen)
            repeats
            churn
            printed
        }
        .feedCallLineIon(isRunning: isRunning)
    }

    /// The kind's own mark, always — a failure recolours the line rather than replacing what it
    /// says happened. The column is drawn empty where there is no mark, not skipped, so every
    /// verb in a run of calls starts on the same vertical.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay {
                if let symbol = call.kind.symbol {
                    ArgoGlyph(symbol, .inline)
                }
            }
            .foregroundStyle(verdict ?? markInk)
    }

    /// How many calls this line stands for, where it stands for more than one.
    @ViewBuilder private var repeats: some View {
        if call.repeats > 1 {
            Text("×\(call.repeats)")
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(restInk)
        }
    }

    @ViewBuilder private var churn: some View {
        if let churn = call.churn, !churn.isSilent {
            HStack(spacing: ArgoSpacing.tight) {
                if churn.added > 0 {
                    Text("+\(churn.added)").foregroundStyle(argo.color.diff.added)
                }
                if churn.removed > 0 {
                    Text("−\(churn.removed)").foregroundStyle(argo.color.diff.removed)
                }
            }
            .argoMono(.body)
            .monospacedDigit()
        }
    }

    /// How much the command printed, where that is worth saying — the stream itself is behind the
    /// chevron.
    @ViewBuilder private var printed: some View {
        if let drawn = call.printed?.drawn {
            Text(drawn)
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(restInk)
        }
    }

    @ViewBuilder private var disclosure: some View {
        if call.disclosure == .available {
            ArgoDisclosure(.beside)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// The ink the whole line takes, or `nil` for everything that did not fail.
    ///
    /// A failure is the ONLY outcome with a colour. For a reader who cannot see the red, the
    /// failure is carried by the accessibility label instead.
    private var verdict: ArgoColor? {
        call.ending.ink.state(in: argo.color)
    }

    /// Whether this is the call the agent is running right now.
    private var isRunning: Bool {
        call.ending == .pending
    }

    /// What the WHOLE line rests at — the verb, the count and what it printed alike. A call still
    /// running sits one step above the ones that finished, and that step IS the Reduce Motion
    /// state: with nothing moving, the row still reads as the live one.
    ///
    /// The churn keeps its diff inks through it, because those are a meaning rather than a rung.
    private var restInk: ArgoColor {
        isRunning ? argo.color.text.secondary : argo.color.text.tertiary
    }

    /// The glyph is the one part of the row carrying the accent at rest.
    private var markInk: ArgoColor {
        isRunning ? argo.color.interaction.accent : argo.color.text.disabled
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(call: FeedCall, isOpen: Bool, open: @escaping () -> Void) {
        self.call = call
        self.isOpen = isOpen
        self.open = open
    }
}

// The one state a still cannot prove, so it is here to be WATCHED: the pass has to cross the whole
// sentence as one piece, with no seam where a word ends.
