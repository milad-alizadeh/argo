import AppKit
import ArgoEngine
import SwiftUI

/// One flat sidebar row over the sidebar's system material.
///
/// The row draws no selection of its own: on macOS 26 the sidebar's own rounded capsule
/// *is* the neutral wash D30 asks for, and it is the same shape Finder, Mail and Xcode
/// select with. Painting a second wash over it produced two stacked highlights, and
/// replacing it means leaving `.listStyle(.sidebar)` — which is what the sidebar's Liquid
/// Glass comes from (D3). Contents only, therefore; selection belongs to the system.
struct SessionRow: View {
    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row
    /// Name this Session, or — with `nil` — drop the name it has. Inert by default, so every
    /// preview and specimen draws the row without a store behind it.
    var rename: (String?) -> Void = { _ in }
    /// Whether this row is the one being typed into. Owned ABOVE the row rather than by it, because
    /// two things outside the row now open the field: the menu bar's Rename, which is addressed at
    /// whichever Session is selected, and the render harness, which cannot click. A row drawn
    /// without one — every plain preview — is a row at rest.
    var isRenaming: Binding<Bool> = .constant(false)

    @State private var typed = ""
    @FocusState private var isFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            primaryLine
            secondaryLine
        }
        .padding(.vertical, ArgoSpacing.tight)
        // A Session nobody here can drive is drawn quieter as a WHOLE — every element of it at
        // once, including the state dot, which is the loudest thing on a running row. Applied
        // over the assembled row rather than per-element so nothing can be left behind at full
        // strength, and so a fact added to the row inherits it without being told.
        .opacity(row.isReadOnly ? ArgoOpacity.ghosted : ArgoOpacity.full)
        .contentShape(.rect)
        .help(inspectionText)
        .contextMenu { copyActions }
        .accessibilityElement(children: .combine)
        // Ghosting is ink, and ink is nothing a screen reader can hear. What is announced is
        // the projection's decision, not a second one taken here.
        .accessibilityLabel(row.announcement)
        // Opened from outside the row — the menu bar, or the render harness. The field seeds and
        // takes focus the same way a double-click seeds it, so there is one way in and not two.
        .onChange(of: isRenaming.wrappedValue) { _, isOpen in
            guard isOpen, !isFieldFocused else { return }
            typed = row.rename.name
            isFieldFocused = true
        }
    }

    private var primaryLine: some View {
        HStack(spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: row.state)
            title
            Spacer(minLength: ArgoSpacing.tight)
            stateWord
        }
    }

    /// The title, and the one thing on the row that is double-clickable: a Session you will come
    /// back to earns a name you chose (#502, story 18).
    ///
    /// The gesture is on the TITLE and not on the row, because the row belongs to the List — a
    /// double-click anywhere on it is two selections of the thing you already selected, and a
    /// field opening off that would take the cursor while somebody was clicking about.
    @ViewBuilder private var title: some View {
        if isRenaming.wrappedValue {
            nameField
        } else {
            Text(row.title)
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
                // SIMULTANEOUS, and that is the whole of it: `onTapGesture` on a subview of a List
                // row consumes the click before the List sees it, which cost the roster its
                // selection — the title is most of the row, so most of the roster stopped
                // selecting. This lets the double-click open the field and the single click
                // through to the List that owns the selection.
                .simultaneousGesture(TapGesture(count: 2).onEnded { beginRenaming() })
        }
    }

    /// The name edited where it is READ — the Finder idiom for a sidebar, and the reason the panel
    /// this replaced is gone: a rename that happens in the row cannot show you one title while you
    /// retype another.
    ///
    /// Return commits, Escape restores, and losing focus commits — which is the platform's own
    /// bargain for edit-in-place and not a fourth rule of Argo's. The Reset the panel had room for
    /// is the row's context menu now (`resetAction`); it is the rarer of the two by far, and
    /// story 20 asks that it exist, not that it sit under the field.
    private var nameField: some View {
        TextField(SessionRenameProjection.prompt, text: $typed)
            .textFieldStyle(.plain)
            .argoText(ArgoTypography.rowTitle)
            .focused($isFieldFocused)
            .lineLimit(1)
            .onSubmit(commitRenaming)
            .onExitCommand(perform: cancelRenaming)
            .onChange(of: isFieldFocused) { _, isFocused in
                guard !isFocused else { return }
                commitRenaming()
            }
            .accessibilityLabel(SessionRenameProjection.prompt)
    }

    /// Seeded at the moment the field opens rather than held in step with the row: re-opening on a
    /// Session renamed since has to draw the name it has NOW, not the one this view was built with.
    private func beginRenaming() {
        typed = row.rename.name
        isRenaming.wrappedValue = true
        isFieldFocused = true
    }

    /// A blank field is not a rename and not a reset — the engine's own rule (`SessionAnnotations`)
    /// rather than a second reading of it, so the store cannot drop a name this row accepted.
    /// Nothing is raised for it: the row closes on the title it already had.
    private func commitRenaming() {
        defer { isRenaming.wrappedValue = false }
        guard SessionAnnotations.name(from: typed) != nil else { return }
        rename(typed)
    }

    private func cancelRenaming() {
        isRenaming.wrappedValue = false
    }

    /// The age takes the leading edge, under the title's own: it is the fact a scan down the
    /// roster finds on nearly every row, and a column that starts where the last worktree name
    /// happened to end is not a column. The worktree takes the right, under the state word.
    ///
    /// Absent entirely when neither half is there, rather than an empty `Text`, which would
    /// leave a gap of whatever height the font happened to give it.
    @ViewBuilder private var secondaryLine: some View {
        if row.worktree != nil || row.age != nil {
            HStack(spacing: ArgoSpacing.snug) {
                if let age = row.age {
                    Text(age)
                        .argoText(ArgoTypography.rowMeta)
                        .lineLimit(1)
                        // Three words that never lose one: a shortfall lands on the worktree
                        // instead, which is built to give up its middle.
                        .layoutPriority(1)
                }
                Spacer(minLength: ArgoSpacing.tight)
                worktreeLabel
            }
            .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// The same two stacked planes the session header spends on a worktree — one mark for one
    /// meaning across the two surfaces. The mark is unconditional here where the header's is not:
    /// the projection populates `worktree` only for a checkout git answered `worktree` for, so
    /// there is no unread kind left for this to claim anything about.
    @ViewBuilder private var worktreeLabel: some View {
        if let worktree = row.worktree {
            ArgoMarkedName(
                symbol: ArgoSymbol.worktree, name: worktree, style: ArgoTypography.rowMeta,
            )
        }
    }

    /// The one exceptional thing the row's first line still carries, on the right edge the age
    /// under it takes — a column of marks reading down the roster rather than a word at wherever
    /// each title happened to end.
    ///
    /// The word takes the dot's own ink, so the two never read as separate claims. The contract
    /// already carries this: every state ink is asserted legible as a word and not only as a dot.
    /// Drawn on the word alone, though — a word the projection spent under a state with no colour
    /// would otherwise be announced and never drawn, which is the disagreement the one
    /// `stateWord` exists to stop.
    @ViewBuilder private var stateWord: some View {
        if let word = row.stateWord {
            Text(word)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(row.state?.tint(in: argo.color) ?? argo.color.text.tertiary)
        }
    }

    @ViewBuilder private var copyActions: some View {
        // The two things here that are not copies: a double-click is the gesture, and a gesture
        // with nothing naming it is a feature only the person who built it knows about.
        Button(SessionRenameProjection.heading) { beginRenaming() }
        resetAction
        Divider()
        Button("Copy Session title") { copy(row.title) }
        if let location = row.location {
            Button("Copy full location") { copy(location) }
        }
        if let branch = row.branch {
            Button("Copy branch") { copy(branch) }
        }
    }

    /// The way back to the title the rename covered up (#502, story 20). Absent entirely for a
    /// Session nobody has renamed: there is nothing to go back to, and a disabled item would read
    /// as a way to clear the name.
    ///
    /// It names the title it restores rather than saying "Reset" alone, because by the time
    /// somebody reaches for this the derived title is nowhere else on screen — which is the whole
    /// reason the story exists, and the one thing the panel did that a menu has to keep doing.
    @ViewBuilder private var resetAction: some View {
        if let derived = row.rename.derived {
            Button("\(SessionRenameProjection.reset) “\(derived)”") { rename(nil) }
        }
    }

    /// The full path, which is what the line above it stands in for — "absolute paths never
    /// appear in the default presentation" (#377), and hover is where the whole of one belongs.
    /// The branch is not here: it is the header's now, and a tooltip repeating it would be a
    /// second place to read a fact that can change between the two.
    private var inspectionText: String {
        [row.title, row.location].compactMap(\.self).joined(separator: "\n")
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}

#Preview("Session row — every rendering") {
    List {
        ForEach(SessionRosterProjection.previewRows) { row in
            SessionRow(row: row).previewSafeListRow()
        }
    }
    .listStyle(.sidebar)
    .frame(width: 300, height: 340)
    .argoAppearance()
}

#Preview("Session row — at the narrowest sidebar width") {
    List {
        ForEach(SessionRosterProjection.previewRows) { row in
            SessionRow(row: row).previewSafeListRow()
        }
    }
    .listStyle(.sidebar)
    .frame(width: 220, height: 340)
    .argoAppearance()
}
