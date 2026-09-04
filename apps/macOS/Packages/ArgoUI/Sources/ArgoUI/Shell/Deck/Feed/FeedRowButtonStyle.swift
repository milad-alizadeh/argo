import ArgoDesign
import SwiftUI

/// A row that opens something, drawn as a line of prose rather than as a control.
///
/// The whole line is the target and not just the filename in it: at this density a word-sized hit
/// area is a row you have to aim at, and every part of the sentence is about the same call anyway.
///
/// Shared by the two rows that open the panel — a call and a folded run of looking — so the one
/// that stands for eight reads cannot end up with a different hit area from the one beneath it.
struct FeedRowButtonStyle: ButtonStyle {
    /// How far a pressable row's ground stands past its words, and how far past its one line.
    ///
    /// Named rather than spelled at the sites that draw them, because a fold's open box and the
    /// names inside it are drawn to the SAME pair: the box has to land exactly where this ground
    /// would have, and a second copy of these numbers is how a header and its list come apart
    /// (#1228).
    nonisolated static let groundInsetX: CGFloat = ArgoSpacing.snug
    nonisolated static let groundInsetY: CGFloat = ArgoSpacing.hair

    @Environment(\.argo) private var argo
    @Environment(\.isEnabled) private var isEnabled

    let isOpen: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.feedRowGround(ground(configuration.isPressed))
    }

    private func ground(_ isPressed: Bool) -> ArgoColor {
        guard isEnabled else { return .transparent }
        if isOpen {
            return argo.color.surface.selected
        }
        return isPressed ? argo.color.surface.selected : .transparent
    }
}

extension View {
    /// The ground a pressable feed row is drawn on, as ONE gesture: pad the words to the row's own
    /// insets, paint behind them, then back the horizontal out again so a row with evidence and one
    /// without still start on the same vertical — the highlight is drawn around the line, not
    /// beside it.
    ///
    /// A modifier rather than a paste, because the fold's names are drawn on the same ground at the
    /// same step, and a second copy of the gesture is how a header and its list come apart — the
    /// jitter of #1354 (#1228).
    func feedRowGround(_ ink: ArgoColor) -> some View {
        padding(.horizontal, FeedRowButtonStyle.groundInsetX)
            .padding(.vertical, FeedRowButtonStyle.groundInsetY)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ink, in: .rect(cornerRadius: ArgoRadius.control))
            .padding(.horizontal, -FeedRowButtonStyle.groundInsetX)
            .contentShape(.rect)
    }
}
