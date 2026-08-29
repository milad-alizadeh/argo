/// The SF Symbols the shell draws, named for meaning rather than appearance. Size is not decided
/// here — a call site picks a rung of `ArgoIconSize`.
public enum ArgoSymbol {
    public static let project = "folder"
    /// A Project whose folder is not where it was registered. The row states that in words too.
    public static let unreachableProject = "folder.badge.questionmark"
    public static let addProject = "plus"
    public static let projectMenu = "ellipsis"
    public static let revealInFinder = "arrow.up.forward.app"
    public static let removeProject = "minus.circle"
    public static let projectSettings = "gearshape"
    public static let newSession = "square.and.pencil"
    /// Clearing a finished Session off the roster. A box and not a bin: the Session is still there,
    /// behind the foot of the roster.
    public static let archive = "archivebox"
    public static let unarchive = "tray.and.arrow.up"
    public static let branch = "arrow.triangle.branch"
    public static let worktree = "square.on.square"
    /// Files changed and not yet committed. Deliberately the same pencil as `edited`.
    public static let uncommitted = edited
    /// Commits made and not yet pushed — the arrow points the way they have not gone.
    public static let unpushed = "arrow.up"
    public static let about = "info.circle"
    /// The work carried on in a fresh Session, on the link at the foot of the reading it came from.
    public static let handedOff = "arrow.right.circle"
    /// The one disclosure chevron. Which way it points is `ArgoDisclosure`'s rotation, never a
    /// second symbol — the scale holds a mark's HEIGHT, so `chevron.down` is wider at the same
    /// rung.
    public static let disclosure = "chevron.right"

    /// One mark per view in the Tickets room's sidebar (`cockpit-work-room.md`). Filled against
    /// outlined tells the two halves of the open set apart at a glance; the shapes tell the four
    /// views apart at any fill.
    public static let allOpenView = "circle.fill"
    public static let unblockedView = "circle"
    public static let inProgressView = "diamond.fill"
    public static let blockedView = "triangle"

    /// The Tickets room's chrome (`cockpit-work-room.md`), each mark named by what the control does
    /// rather than by its shape.
    /// The COMPOSE mark, which Mail spends on the one thing its window creates. This room creates a
    /// ticket and New Session is not in its bar (#836), so the two marks are never in one bar and
    /// the plus that kept them apart is no longer earning anything.
    public static let newTicket = newSession
    /// Re-ordering the backlog. A MENU and not a mark of its own: Mail keeps sort and group inside
    /// the ellipsis beside its filter, and the banded-rows glyph that stood here was invented for
    /// an act the platform already has a home for (#836).
    public static let backlogMenu = projectMenu
    public static let searchBacklog = "magnifyingglass"
    /// Starting a Session on the open ticket — the verb the room is for. A play triangle rather
    /// than a bolt: the bolt was read as speed or as power, and neither is the act.
    public static let startSession = "play.fill"
    /// Opening the ticket where its provider holds it, and taking that address to the pasteboard.
    /// The arrow leaves the app; the chain is the address itself.
    public static let openOnHost = "arrow.up.forward.square"
    public static let copyLink = "link"

    /// One mark per room, and since #690 the whole of what a room tab draws.
    ///
    /// `apple.terminal` is a terminal WINDOW. Bare `terminal` is `ran` below, the feed's mark for a
    /// command that ran, and one glyph cannot mean both a room and a step inside it.
    public static let sessionsRoom = "apple.terminal"
    public static let ticketsRoom = "checklist"
    public static let codeRoom = programSource

    /// One mark per kind of call the feed can name. A call whose kind Argo could not read carries
    /// NO mark, deliberately — a mark is a claim about what happened.
    public static let searched = "magnifyingglass"
    public static let read = "doc.text"
    public static let edited = "pencil"
    public static let created = "doc.badge.plus"
    public static let deleted = "trash"
    public static let moved = "arrow.right.doc.on.clipboard"
    public static let ran = "terminal"
    /// A skill the agent invoked by name — instructions, not a program on the machine.
    public static let skill = "wand.and.sparkles"
    public static let fetched = "globe"
    public static let delegated = "arrow.turn.down.right"
    public static let mcpTool = "puzzlepiece.extension"
    /// A folded run of looking — reads and searches at once, so neither of their marks.
    public static let looked = "eye"
    // A call's outcome has no mark of its own: a failure is the line in the failure ink, and
    // success is the default a feed may assume.

    /// A question put to somebody, waiting or settled.
    public static let asked = "questionmark.bubble"
    /// The option an answer named — the one tick in the feed, marking a CHOICE and not a success.
    public static let chosen = "checkmark"
    /// A line of the record nothing could parse. Deliberately not a failure's mark: nothing went
    /// wrong with the agent's work here.
    public static let unreadable = "questionmark.square.dashed"

    /// Closing the evidence panel.
    public static let dismiss = "xmark"

    /// Opening and closing the evidence panel from the toolbar (#875). The platform's own
    /// right-sidebar mark, because that is the shape the panel takes: a column at the trailing
    /// edge, not a sheet and not an inspector of its own invention.
    public static let evidencePanel = "sidebar.right"

    /// Taking a step's address to the pasteboard — the platform's own copy mark.
    public static let copyAddress = "doc.on.doc"
    /// A file outside the tree the Session is working in.
    public static let externalFile = "arrow.up.forward.square"

    /// Back to the newest thing in the feed, from wherever the reader scrolled to.
    public static let latest = "arrow.down"

    /// The composer's send: an arrow and no word.
    public static let send = "arrow.up"

    // The composer's Stop (#541) has no entry: no rung of the icon scale reaches the size it is
    // drawn at, so it is a drawn square measured in `ArgoComposerVessel.stopMark`.

    /// The composer's attach control (#540) — a `+`, not a paperclip, since drop and paste are the
    /// same act.
    public static let attach = "plus"

    /// An attachment chip's mark when the file is not a picture, or the bytes yield no thumbnail.
    public static let attachedImage = "photo"
    public static let attachedFile = "doc"

    /// A send the Session refused — on the seam, beside the reason. A triangle is earned where the
    /// feed's rows never take one: this failure is Argo's own act, not a reading of the agent's.
    public static let refused = "exclamationmark.triangle"

    /// Try the refused send again, with the message exactly where it was typed.
    public static let retry = "arrow.clockwise"

    /// A draft that survived leaving the Session — a clock, since the line reports the age.
    public static let draftKept = "clock"

    /// A Permission waiting on the user. A lock, not a question mark: the agent is barred, not
    /// wondering.
    public static let permission = "lock.fill"

    /// A Session that cannot be driven (#546). The lock is OUTLINED where a waiting Permission's is
    /// filled: this one bars nobody, it reports a Session Argo never had the keys to. The triangle
    /// is `refused`'s and earned for the same reason — an orphaned Session is Argo's own act
    /// failing, not a reading of the agent's.
    public static let readOnlySession = "lock"
    public static let orphanedSession = refused

    /// One mark per rung of the composer's Mode ladder, frozen by the composer design (#608).
    public static let modeReadOnly = looked
    public static let modePlan = "list.bullet.rectangle"
    public static let modeCode = programSource
    public static let modeAuto = "bolt"
    /// A stance Argo cannot place on the ladder — not a rung, so it is never offered as one.
    public static let modeUnknown = "questionmark"

    /// What a file the panel is open on is written in — one mark per language FAMILY, since the
    /// extension beside it is what names the language. Markup has none on purpose: the nearest
    /// glyph is the same chevrons with one word different.
    public static let swiftSource = "swift"
    public static let programSource = "chevron.left.forwardslash.chevron.right"
    public static let dataSource = "curlybraces"
    public static let proseSource = "text.alignleft"
    /// A file whose extension Argo does not recognise, and anything the panel opens on that is not
    /// a file at all.
    public static let plainSource = "doc"

    /// Switching the panel between the patch the record carries and the document that patch made.
    /// One control carrying the mark of where it goes, so the two are never on screen together.
    public static let readAsSource = programSource
    public static let readAsProse = "doc.richtext"

    /// Where a step of the plan has got to. The SHAPE carries the reading on its own: an empty ring
    /// is untouched, a half-filled one is under way, a tick is behind the agent. Colour repeats it
    /// only for the step in progress.
    public static let stepPending = "circle"
    public static let stepInProgress = "circle.lefthalf.filled"
    public static let stepCompleted = "checkmark.circle.fill"
}
