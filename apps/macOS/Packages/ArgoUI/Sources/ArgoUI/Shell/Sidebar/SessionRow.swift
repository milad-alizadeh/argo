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
            lock
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

    /// The run kind and the clock take the leading edge, the worktree the right under the state
    /// word. Absent entirely when none of the three is there — an empty `Text` would leave a gap of
    /// the font's height.
    @ViewBuilder private var secondaryLine: some View {
        if row.worktree != nil || row.clock != nil || row.runKind != nil {
            HStack(spacing: ArgoSpacing.snug) {
                runKindLabel
                if let clock = row.clock {
                    RosterTurnClock(clock: clock)
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

    /// Ahead of the clock, because it is the fact that tells two Sessions on one ticket apart
    /// (#745) and the leading edge is where the eye lands.
    @ViewBuilder private var runKindLabel: some View {
        if let runKind = row.runKind {
            Text(runKind)
                .argoText(ArgoTypography.rowMeta)
                .lineLimit(1)
                .layoutPriority(1)
        }
    }

    /// The mark is unconditional here where the session header's is not: the projection populates
    /// `worktree` only for a checkout git answered `worktree` for.
    @ViewBuilder private var worktreeLabel: some View {
        if let worktree = row.worktree {
            ArgoKindedName(
                symbol: ArgoSymbol.worktree, name: worktree, style: ArgoTypography.rowMeta,
            )
        }
    }

    /// Beside the name, because what it says is about the Session and the far column is the
    /// state's. Hidden from a screen reader, which hears the fact in `row.announcement`.
    @ViewBuilder private var lock: some View {
        if let mark = row.lock {
            ArgoGlyph(mark, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .accessibilityHidden(true)
        }
    }

    /// The word takes the state dot's own ink — every state ink is asserted legible as a word and
    /// not only as a dot. Drawn even under a state with no colour, or it would be announced and
    /// never drawn.
    ///
    /// Above the title in priority: a title that gives up characters still reads, and a truncated
    /// badge says a different state (`composer/perm.png`, where the title is the line that cuts).
    @ViewBuilder private var stateWord: some View {
        if let word = row.stateWord {
            ArgoStateLabel(word: word)
                .foregroundStyle(row.state?.tint(in: argo.color) ?? argo.color.text.tertiary)
                .layoutPriority(1)
        }
    }

    @ViewBuilder private var copyActions: some View {
        // Rename and Reset are not copies: they name the gestures nothing else on screen does.
        Button(SessionRenameProjection.heading) { beginRenaming() }
        resetAction
        Divider()
        Button("Copy Session title") { ArgoPasteboard.put(row.title) }
        if let location = row.location {
            Button("Copy full location") { ArgoPasteboard.put(location) }
        }
        if let branch = row.branch {
            Button("Copy branch") { ArgoPasteboard.put(branch) }
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
}
