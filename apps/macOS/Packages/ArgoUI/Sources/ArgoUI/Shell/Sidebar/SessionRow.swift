import AppKit
import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// One flat sidebar row over the sidebar's system material. It draws no selection of its own: the
/// ground is the list's, through `.argoSelectedRowGround(isSelected:)` (D30, as amended by #875).
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
        // A fold takes no `List` tag, so neither the keyboard nor a screen reader's own
        // activation can reach it (`SessionNavigator`). This is the way in that does not need a
        // pointer.
        .accessibilityActions {
            if row.fold != nil {
                Button("Open") { select() }
            }
        }
    }

    private var primaryLine: some View {
        HStack(spacing: ArgoSpacing.snug) {
            marker
            title
            lock
            Spacer(minLength: ArgoSpacing.tight)
            stateWord
        }
    }

    /// The leading column: what the Session is DOING, or — on a fold — whether it is open. One of
    /// the two is a state and the other is a control, and no row is both. Framed to the dot's own
    /// box either way, so every title on the roster stays on one x.
    @ViewBuilder private var marker: some View {
        if let fold = row.fold {
            ArgoDisclosure(fold.isOpen ? .below : .beside)
                .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
                .foregroundStyle(argo.color.text.tertiary)
                .accessibilityHidden(true)
        } else {
            SessionStateIndicator(state: row.state)
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
        typed = row.rename?.name ?? ""
        for _ in 0 ..< Self.focusAttempts where !isFieldFocused {
            isFieldFocused = true
            try? await Task.sleep(for: Self.focusRetry)
        }
    }

    /// Opens the field. The name and the focus belong to the field itself (`open`).
    /// A fold has no name of its own to change, so the field never opens on one.
    func beginRenaming() {
        guard row.rename != nil else { return }
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

    /// The row's distinguishing fact and the clock take the leading edge, the worktree the right
    /// under the state word. Absent entirely when none of the three is there — an empty `Text`
    /// would leave a gap of the font's height.
    @ViewBuilder private var secondaryLine: some View {
        if row.worktree != nil || row.clock != nil || row.toldApart != nil {
            HStack(spacing: ArgoSpacing.snug) {
                toldApartLabel
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

    /// Ahead of the clock, because the leading edge is where the eye lands and this is the slot
    /// the reader scans to place the row (#745, #1072).
    @ViewBuilder private var toldApartLabel: some View {
        if let toldApart = row.toldApart {
            Text(toldApart)
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
}
