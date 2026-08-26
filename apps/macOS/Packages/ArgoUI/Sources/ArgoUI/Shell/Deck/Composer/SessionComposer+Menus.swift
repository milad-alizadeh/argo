import ArgoEngine
import SwiftUI

/// Which menu the composer's line opens, and what it draws — `/` and `@` (#685, #687).
///
/// The state both menus read stays on `SessionComposer`, because a SwiftUI extension can hold none.
extension SessionComposer {
    /// The `/` menu the line opens, and `nil` where none does — an adapter that declares no command
    /// surface, a line that is not a command, or an Escape the reader has not typed past.
    var menu: CommandMenuProjection.Menu? {
        guard composer.canRunCommands, !isDismissed else { return nil }
        return CommandMenuProjection.menu(for: draft.text, in: catalog)
    }

    /// The `@` menu, on the same conditions less the first: naming a file is Argo's own act, so it
    /// is offered wherever there is a Workspace to name one in — including a `codex` Session, which
    /// declares no command surface and gets no `/` menu at all (design decision 14).
    ///
    /// Never open at the same time as `menu` above, and by construction rather than by a guard:
    /// `/` opens only at the head of the line, `@` only on a token the reader is still typing.
    var mentionMenu: WorkspaceFileProjection.Menu? {
        // No Workspace, no menu — not an empty one. "No file matches" is a statement about a tree,
        // and there is no tree here to have looked in. A read still in flight is the same case:
        // `workspaceFiles` is nil until it answers, so the zero line cannot speak for a tree first.
        guard !isDismissed, composer.workspaceRoot != nil, let workspaceFiles else { return nil }
        return WorkspaceFileProjection.menu(
            for: draft.text,
            in: workspaceFiles,
            touched: composer.touchedFiles,
        )
    }

    /// It takes the vessel's own width, because the description is the content: at any stated width
    /// two thirds of a real `description:` would be an ellipsis.
    @ViewBuilder var commandMenu: some View {
        if let menu {
            CommandMenu(menu: menu, marked: cursor.marked) { draft.take($0.command) }
                .padding(.bottom, Self.gapAboveVessel)
        }
    }

    @ViewBuilder var fileMenu: some View {
        if let mentionMenu {
            FileMenu(menu: mentionMenu, marked: cursor.marked, pick: take(mention:))
                .padding(.bottom, Self.gapAboveVessel)
        }
    }

    /// The design's `base` above the vessel, less what the stack around it already contributes —
    /// spelled as the arithmetic so moving either step keeps the gap.
    static var gapAboveVessel: CGFloat {
        ArgoSpacing.base - ArgoSpacing.tight
    }

    /// The ids of whichever menu is open, in drawing order — what the cursor walks and what ⏎
    /// picks out of, so neither can fall out of step with the list on screen.
    var markedIDs: [String] {
        menu?.rows.map(\.id) ?? mentionMenu?.rows.map(\.id) ?? []
    }

    /// Re-read whatever the line has just opened, which is what puts a skill installed — or a file
    /// written — while the Session was open in the very next list. No watcher, no restart.
    ///
    /// The `@` read is launched and not waited on, so a hundred-thousand-path tree lists behind a
    /// composer that stayed typeable throughout. It runs on the token OPENING rather than on every
    /// keystroke, because the tree does not change while a word is being typed into it.
    func opened(_ was: String = "") {
        isDismissed = false
        catalog = openedCommands()
        if WorkspaceFileProjection.mention(in: draft.text) != nil,
           WorkspaceFileProjection.mention(in: was) == nil {
            Task { workspaceFiles = await WorkspaceFileProjection.Tree(files()) }
        }
    }

    private func openedCommands() -> CommandCatalog {
        guard composer.canRunCommands, CommandMenuProjection.query(in: draft.text) != nil else {
            return CommandCatalog.empty
        }
        return commands()
    }

    /// `send`, with the mentioned files NAMED where the CLI will not resolve an `@path` itself
    /// (#687). Wrapped once rather than at the three call sites, so a queued Turn and a retried one
    /// carry their files exactly as a straight send does.
    ///
    /// They ride the attachment path and never `draft.attachments`, which is what keeps a mention
    /// out of the tray: it stays a word in the line, and only the Turn that goes names the file.
    var sending: ComposerSend {
        guard !composer.resolvesMentions else { return send }
        return { [composer, send] text, attachments in
            try send(text, ComposerMentions.attaching(
                attachments,
                for: text,
                within: composer.workspaceRoot,
            ))
        }
    }

    /// A picked file, put where the `@` token was. The range comes off the line rather than off the
    /// row, because what is being replaced is what the reader typed.
    func take(mention row: WorkspaceFileProjection.Row) {
        guard let mention = WorkspaceFileProjection.mention(in: draft.text) else { return }
        draft.take(mention: row, replacing: mention.range)
    }
}
