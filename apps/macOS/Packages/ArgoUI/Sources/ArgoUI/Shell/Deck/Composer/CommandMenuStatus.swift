import ArgoEngine
import SwiftUI

/// The one line above the `/` menu's list saying how the slower of its two halves is doing (#686,
/// `cockpit-composer-picker.md` decisions 9 and 10).
///
/// PINNED above the list rather than drawn where the Claude Code section would be. In its own place
/// it sits below ten rows of skills, where the reader about to conclude the CLI has no `/compact`
/// will never scroll to it.
struct CommandMenuStatus: View {
    let builtins: BuiltinStatus

    var body: some View {
        switch builtins {
        // A strip saying the list is complete is a line the reader re-reads to learn nothing.
        case .read: EmptyView()
        case .reading: CommandMenuStatusLine(words: Self.reading, mark: .waiting)
        case .unavailable: CommandMenuStatusLine(words: Self.unavailable, mark: .failed)
        }
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

#Preview("Command menu status — every state") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        CommandMenuStatus(builtins: .reading)
        CommandMenuStatus(builtins: .unavailable)
        // Draws nothing, which is the state — the gap below the two lines is the whole render.
        CommandMenuStatus(builtins: .read)
    }
    .padding(ArgoSpacing.base)
    .frame(width: 640)
    .argoAppearance()
}
