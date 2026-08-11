import AppKit
import ArgoEngine
import SwiftUI

/// One flat sidebar row over the sidebar's system material. It draws no selection of its own:
/// `.listStyle(.sidebar)`'s own capsule is the wash (D30, D3), and a second one over it stacks
/// two highlights.
struct SessionRow: View {
    /// Bound and interval on the focus retries in `open()`.
    private static let focusAttempts = 20
    private static let focusRetry = Duration.milliseconds(20)

    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row
    /// Name this Session, or — with `nil` — drop the name it has. Inert by default.
    var rename: (String?) -> Void = { _ in }
    /// Whether this row is the one being typed into. Owned ABOVE the row, because the menu bar's
    /// Rename and the render harness both open the field from outside it.
    var isRenaming: Binding<Bool> = .constant(false)
    /// Make this row the selected one. The row selects ITSELF because a tap gesture inside a `List`
    /// row swallows the click the `List` selects with — see the gestures on `body`.
    var select: () -> Void = {}

    @State private var typed = ""
    @FocusState private var isFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            primaryLine
            secondaryLine
        }
        .padding(.vertical, ArgoSpacing.tight)
        // Applied over the assembled row, so nothing added to it is left behind at full strength.
        .opacity(row.isReadOnly ? ArgoOpacity.ghosted : ArgoOpacity.full)
        .contentShape(.rect)
        // `.contain` while the field is open so it stays reachable; `.ignore` at rest makes the
        // whole row one element to a screen reader.
        .accessibilityElement(children: isRenaming.wrappedValue ? .contain : .ignore)
        .accessibilityLabel(row.announcement)
        // AFTER the title's own gestures, so the double-click layer cannot stand between the
        // pointer and the menu holding Reset (#502, story 20).
        .help(inspectionText)
        .contextMenu { copyActions }
    }

    private var primaryLine: some View {
        HStack(spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: row.state)
            title
            Spacer(minLength: ArgoSpacing.tight)
            stateWord
        }
    }

    /// The clear layer over the title alone that answers BOTH clicks: a tap gesture inside a `List`
    /// row hit-tests ahead of the row and swallows the click the `List` selects with, so a layer
    /// taking only the double-click would cost the title its selection.
    private var clickCatcher: some View {
        Color.clear
            .contentShape(.rect)
            // Two before one: a single tap declared first would fire on the opening click of
            // every double one.
            .onTapGesture(count: 2) {
                select()
                beginRenaming()
            }
            .onTapGesture(count: 1) { select() }
            .accessibilityHidden(true)
    }

    @ViewBuilder private var title: some View {
        if isRenaming.wrappedValue {
            nameField
        } else {
            Text(row.title)
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
                // Only while the row is at rest: the field keeps its own clicks, or the caret
                // cannot be placed.
                .overlay { clickCatcher }
        }
    }

    /// The name edited where it is READ. Return commits, Escape restores, and losing focus commits;
    /// Reset lives in the row's context menu (`resetAction`).
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
            .task { await open() }
    }

    /// The field's own first moment. It lives on the field because focus cannot be taken before the
    /// thing being focused exists, and the name is read here so a re-open draws the name it has
    /// NOW.
    ///
    /// Asked for until it is HELD: the `List` keeps keyboard focus until its own update settles,
    /// and a request made before then is dropped without a word.
    private func open() async {
        typed = row.rename.name
        for _ in 0 ..< Self.focusAttempts where !isFieldFocused {
            isFieldFocused = true
            try? await Task.sleep(for: Self.focusRetry)
        }
    }

    /// Opens the field. The name and the focus belong to the field itself (`open`).
    private func beginRenaming() {
        isRenaming.wrappedValue = true
    }

    /// A blank field is not a rename and not a reset, by the engine's own rule
    /// (`SessionAnnotations`); the row closes on the title it already had.
    private func commitRenaming() {
        defer { isRenaming.wrappedValue = false }
        guard SessionAnnotations.name(from: typed) != nil else { return }
        rename(typed)
    }

    private func cancelRenaming() {
        isRenaming.wrappedValue = false
    }

    /// The age takes the leading edge, the worktree the right under the state word. Absent entirely
    /// when neither half is there — an empty `Text` would leave a gap of the font's height.
    @ViewBuilder private var secondaryLine: some View {
        if row.worktree != nil || row.age != nil {
            HStack(spacing: ArgoSpacing.snug) {
                if let age = row.age {
                    Text(age)
                        .argoText(ArgoTypography.rowMeta)
                        .lineLimit(1)
                        // A width shortfall lands on the worktree instead, which gives up its
                        // middle.
                        .layoutPriority(1)
                }
                Spacer(minLength: ArgoSpacing.tight)
                worktreeLabel
            }
            .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// The mark is unconditional here where the session header's is not: the projection populates
    /// `worktree` only for a checkout git answered `worktree` for.
    @ViewBuilder private var worktreeLabel: some View {
        if let worktree = row.worktree {
            ArgoMarkedName(
                symbol: ArgoSymbol.worktree, name: worktree, style: ArgoTypography.rowMeta,
            )
        }
    }

    /// The word takes the state dot's own ink — every state ink is asserted legible as a word and
    /// not only as a dot. Drawn even under a state with no colour, or it would be announced and
    /// never drawn.
    ///
    /// Set as a badge — uppercase and tracked, the same role the Permission prompt's own
    /// `PERMISSION` label takes. One treatment for the slot rather than one per word: amber and red
    /// are the same kind of claim, and typography that separated them would rank them.
    ///
    /// Above the title in priority, because a truncated badge says a different thing — the title is
    /// what gives up the width, which is what the render at 1440 shows.
    @ViewBuilder private var stateWord: some View {
        if let word = row.stateWord {
            Text(word)
                .argoText(ArgoTypography.badge)
                .textCase(.uppercase)
                .foregroundStyle(row.state?.tint(in: argo.color) ?? argo.color.text.tertiary)
                .lineLimit(1)
                .layoutPriority(1)
        }
    }

    @ViewBuilder private var copyActions: some View {
        // Rename and Reset are not copies: they name the gestures nothing else on screen does.
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

    /// The way back to the title the rename covered up (#502, story 20). Absent for a Session
    /// nobody renamed, and it names the title it restores — nothing else on screen shows it.
    @ViewBuilder private var resetAction: some View {
        if let derived = row.rename.derived {
            Button("\(SessionRenameProjection.reset) “\(derived)”") { rename(nil) }
        }
    }

    /// The full path, which the line above stands in for — absolute paths never appear in the
    /// default presentation (#377). The branch is not here: it is the header's.
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
