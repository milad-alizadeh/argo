import ArgoEngine
import SwiftUI

/// The one line above the `/` menu's list saying how the slower of its two halves is doing (#686,
/// `cockpit-composer-picker.md` decisions 9 and 10).
///
/// PINNED above the list rather than drawn where the Claude Code section would be. In its own
/// place it sits below ten rows of skills, where the reader who is about to conclude the CLI has no
/// `/compact` will never scroll to it.
///
/// It draws nothing at all once the read has landed: a strip saying the list is complete is a line
/// the reader has to read every time to learn nothing.
struct CommandMenuStatus: View {
    @Environment(\.argo) private var argo

    let builtins: BuiltinStatus

    var body: some View {
        switch builtins {
        case .read: EmptyView()
        case .reading: line(Self.reading, in: argo.color.text.tertiary) { dot }
        case .unavailable: line(Self.unavailable, in: argo.color.state.attention) { warning }
        }
    }

    private func line(
        _ words: String,
        in ink: ArgoColor,
        @ViewBuilder mark: () -> some View,
    )
        -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            mark()
            Text(words)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ink)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoComposerVessel.commandRowHeight, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// The same dot the roster and the connection chip wait on, so waiting looks like waiting
    /// wherever it happens.
    private var dot: some View {
        Circle()
            .fill(argo.color.text.tertiary.color)
            .frame(width: ArgoLayout.statusDotSize, height: ArgoLayout.statusDotSize)
    }

    private var warning: some View {
        Image(systemName: ArgoSymbol.refused)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.state.attention)
    }

    /// Says what is missing AND that nothing is: the skills below are all of them, so the reader
    /// is not being asked to wait before using the menu.
    static let reading = "Reading Claude Code's own commands — your skills are already here."
    /// Names the failure and then the way round it, because typing a built-in blind has always
    /// worked and goes on working (decision 10).
    static let unavailable = """
    Argo could not read this CLI's built-in commands, so only skills are listed. \
    Typing a built-in by name still works.
    """
}
