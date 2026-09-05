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
    /// Drawn by the sidebar view AND by a backlog row's blockage mark, which is why it is one
    /// constant (#939). The prohibition sign, so the mark names the state rather than a shape.
    /// FILLED, like `allOpenView` and `inProgressView`: `nosign` has no fill variant of its own,
    /// and `slash.circle.fill` is the same sign drawn solid.
    public static let blockedView = "slash.circle.fill"
    /// The fifth view, which is the only one not defined over the open set (#1075). A clock turning
    /// back rather than a tick or a cross: the view holds `resolved` AND `ruledOut`, and either of
    /// those marks would name one of the two buckets as the whole view. It also says which ORDER
    /// the list is in, which is the one thing that distinguishes this view's list from the others.
    /// Outlined, and outside the fill split above: it is not one of the open set's halves.
    public static let closedView = "clock.arrow.circlepath"

    /// The Tickets room's chrome (`cockpit-work-room.md`), each mark named by what the control does
    /// rather than by its shape.
    /// The COMPOSE mark, which Mail spends on the one thing its window creates. This room creates a
    /// ticket and New Session is not in its bar (#836), so the two marks are never in one bar and
    /// the plus that kept them apart is no longer earning anything.
    public static let newTicket = newSession
    /// Re-ordering the backlog. A MENU and not a mark of its own: Mail keeps sort and group inside
    /// the ellipsis beside its filter, and the banded-rows glyph that stood here was invented for
    public static let searchBacklog = "magnifyingglass"
    /// Starting a Session on the open ticket — the verb the room is for. A play triangle rather
    /// than a bolt: the bolt was read as speed or as power, and neither is the act.
    public static let startSession = "play.fill"
    /// Opening the ticket where its provider holds it, and taking that address to the pasteboard.
    /// The arrow leaves the app; the chain is the address itself.
    public static let openOnHost = "arrow.up.forward.square"
    public static let copyLink = "link"
    /// Closing the open ticket (#1333). A ring closing rather than a plain `xmark`: the control
    /// opens a menu of two reasons, and the mark has to say "closes" without picking either.
    public static let closeTicket = "xmark.circle"
    /// A closed ticket's twin verb, put back where it started (#1333).
    public static let reopenTicket = "arrow.uturn.backward.circle"

    /// One mark per room, and since #690 the whole of what a room tab draws.
    ///
    /// `apple.terminal` is a terminal WINDOW. Bare `terminal` is `ran` below, the feed's mark for a
    /// command that ran, and one glyph cannot mean both a room and a step inside it.
    public static let sessionsRoom = "apple.terminal"
    public static let ticketsRoom = "checklist"
    public static let codeRoom = programSource
    /// The Atlas draws the Project as a place, and a map is the mark for one (#1140).
    public static let atlasRoom = "map"

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
    /// A delegation coming BACK (#1281). `delegated` turned around, so the handover and its ending
    /// read as one pair down the mark column.
    public static let returned = "arrow.turn.up.left"
    public static let mcpTool = "puzzlepiece.extension"
    /// A folded run of looking — reads and searches at once, so neither of their marks.
    public static let looked = "eye"
    /// A folded stretch of a Turn's work — commands, edits and tools at once, so none of theirs.
    public static let worked = "hammer"
    // A call's outcome has no mark of its own: a failure is the line in the failure ink, and
    // success is the default a feed may assume.

    /// A question put to somebody, waiting or settled.
    public static let asked = "questionmark.bubble"
    /// The option an answer named — the one tick in the feed, marking a CHOICE and not a success.
    public static let chosen = "checkmark"
    /// The way a settled question went, where the answer named no option it offered (#1207). Says
    /// CONTINUES, not chosen. Its own role beside `delegated`, which carries the same SF name.
    public static let answered = "arrow.turn.down.right"
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

    /// The Session's own reading, at the head of the agents rail (#1013). The trunk its
    /// delegations hang off, and deliberately not a back arrow: the entry is a chip like the ones
    /// under it, not a way out of somewhere.
    public static let sessionReading = "list.bullet.indent"

    /// The composer's send: an arrow and no word.
    public static let send = "arrow.up"

    // The composer's Stop (#541) has no entry: no rung of the icon scale reaches the size it is
    // drawn at, so it is a drawn square measured in `ArgoComposerVessel.stopMark`.

    /// Steering one queued follow-up into the running Turn instead of waiting for it to end
    /// (#1238) — the chip's own control, beside its `×`.
    ///
    /// A skip-ahead and NOT the send arrow above: what this does is overtake, and a second arrow
    /// pointing the same way as the vessel's would say the two acts were the same one. It is not
    /// the Stop mark either, though it begins with the same keystroke — the reader's intent here
    /// is to deliver, and a square would promise the opposite.
    public static let steer = "forward.fill"

    /// The composer's attach control (#540) — a `+`, not a paperclip, since drop and paste are the
    /// same act.
    public static let attach = "plus"

    /// `AddMenu`'s two rows (#689, `cockpit-composer-picker.md`, `plus.png`) — a folder for the
    /// in-app Workspace tree, and the feed's own mark for a skill reused for the row that also
    /// names a built-in command.
    public static let addMenuFiles = "folder"
    public static let addMenuCommands = skill

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

    /// Putting what a Session runs at back where it started (#558).
    public static let reset = "arrow.counterclockwise"

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

    /// The Atlas's own view toggle (#1152) — the city standing, and the same tiling seen straight
    /// down.
    public static let atlasCity = "building.2"
    public static let atlasTreemap = "square.grid.2x2"
    /// The orbit handle that turns and tilts the city.
    public static let atlasOrbit = "rotate.3d"
}
