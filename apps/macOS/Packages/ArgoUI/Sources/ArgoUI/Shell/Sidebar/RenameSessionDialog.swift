import ArgoEngine
import SwiftUI

/// The panel a double-click on a roster row's title opens. Its words and its seed are
/// `SessionRenameProjection`'s — this draws them and raises the one intent.
///
/// A dialog rather than an editable row, deliberately: renaming is rare and undoable, and a title
/// that turned into a field under a double-click would put a text cursor in a list whose every
/// other click selects. The panel also has somewhere to put the Reset, which the row does not.
struct RenameSessionDialog: View {
    @Environment(\.argo) private var argo

    let rename: SessionRenameProjection.Rename
    /// The name to keep, or `nil` to drop the one there is — the Reset. One closure, because it is
    /// one decision: a pair would let a surface offer the way in without the way out.
    let commit: (String?) -> Void
    let cancel: () -> Void

    /// Seeded on appear rather than in an initialiser, so re-opening the dialog on a Session
    /// renamed since draws the name it has now instead of the one this view was first built with.
    @State private var typed = ""
    @FocusState private var isFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text(SessionRenameProjection.heading)
                .argoText(ArgoTypography.sectionLabel)
                .foregroundStyle(argo.color.text.secondary)
            field
            derived
            controls
        }
        .padding(ArgoSpacing.loose)
        .frame(width: ArgoLayout.renameDialogWidth, alignment: .leading)
        .onAppear {
            typed = rename.name
            isFieldFocused = true
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(SessionRenameProjection.heading)
    }

    private var field: some View {
        TextField(SessionRenameProjection.prompt, text: $typed)
            .textFieldStyle(.roundedBorder)
            .argoText(ArgoTypography.body)
            .focused($isFieldFocused)
            .onSubmit(save)
            .accessibilityLabel(SessionRenameProjection.prompt)
    }

    /// The title the rename covered up, said out loud beside the control that goes back to it —
    /// because by the time somebody wants it, it is nowhere else on screen (#502, story 20).
    ///
    /// Absent entirely for a Session nobody has renamed: there is nothing to go back to, and a
    /// disabled control would read as a way to clear the field.
    @ViewBuilder private var derived: some View {
        if let derived = rename.derived {
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                Text(derived)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(2)
                    .truncationMode(.tail)
                Button(SessionRenameProjection.reset) { commit(nil) }
                    .buttonStyle(.plain)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.interaction.accent)
            }
        }
    }

    private var controls: some View {
        HStack(spacing: ArgoSpacing.base) {
            Spacer(minLength: ArgoSpacing.tight)
            // Escape reaches this whether or not anything on the panel has focus, which is what
            // makes dismissing without renaming a keystroke rather than a click (#515).
            Button(SessionRenameProjection.cancel, action: cancel)
                .keyboardShortcut(.cancelAction)
            Button(SessionRenameProjection.confirm, action: save)
                .keyboardShortcut(.defaultAction)
                // A confirm that silently reset the Session would be the Reset control taken by
                // surprise, so what is in the field is asked of the type that decides it.
                .disabled(spoken == nil)
        }
        .argoText(ArgoTypography.control)
    }

    /// What is in the field, as a NAME — `nil` while it is blank. The engine's own rule rather
    /// than a second reading of it: the store would drop a name this view had accepted.
    private var spoken: String? {
        SessionAnnotations.name(from: typed)
    }

    private func save() {
        guard spoken != nil else { return }
        commit(typed)
    }
}

#Preview("Rename dialog — a Session already renamed, with its derived title under the field") {
    RenameSessionDialog(
        rename: RenameDialogFixture.renamed,
        commit: { _ in },
        cancel: {},
    )
    .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Rename dialog — a Session nobody has renamed, so there is nothing to reset") {
    RenameSessionDialog(
        rename: RenameDialogFixture.untouched,
        commit: { _ in },
        cancel: {},
    )
    .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
