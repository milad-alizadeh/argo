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
    @Environment(\.argo) private var argo
    @Environment(\.isEnabled) private var isEnabled

    let isOpen: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, ArgoSpacing.snug)
            .padding(.vertical, ArgoSpacing.hair)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ground(configuration.isPressed),
                in: .rect(cornerRadius: ArgoRadius.control),
            )
            // Back out the inset the ground needs, so a row with evidence and one without still
            // start on the same vertical. The highlight is drawn around the line, not beside it.
            .padding(.horizontal, -ArgoSpacing.snug)
            .contentShape(.rect)
    }

    private func ground(_ isPressed: Bool) -> ArgoColor {
        guard isEnabled else { return .transparent }
        if isOpen {
            return argo.color.surface.selected
        }
        return isPressed ? argo.color.surface.selected : .transparent
    }
}
