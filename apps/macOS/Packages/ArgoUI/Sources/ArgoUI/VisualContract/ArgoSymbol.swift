/// The SF Symbols the shell draws, named for what they mean rather than for what they look like.
///
/// A symbol is a token like a colour is: one place decides which mark stands for a Project, so the
/// vessel and the drawer cannot drift into two marks for one thing. Size is not decided here — a
/// call site picks a rung of `ArgoIconSize`.
public enum ArgoSymbol {
    /// A Project: a registered folder, which is what the drawer's path line says it is.
    public static let project = "folder"
    /// A Project whose folder is not where it was registered. The row states that in words too —
    /// this mark is the second reading of it, never the only one.
    public static let unreachableProject = "folder.badge.questionmark"
    /// Registering a Project — the drawer's footer.
    public static let addProject = "plus"
    /// The row menu carrying a Project's management verbs.
    public static let projectMenu = "ellipsis"
    public static let revealInFinder = "arrow.up.forward.app"
    public static let locateProject = "questionmark.folder"
    public static let removeProject = "minus.circle"
    /// Re-entering the Connect panel on a Project that exists. The platform's settings mark, since
    /// that is what this is — a Project's, not the app's.
    public static let projectSettings = "gearshape"
    /// Starting a Session — the toolbar's leading control. The platform's compose mark rather than
    /// a bare `plus`: `plus` is what the drawer spends on registering a Project, and one mark for
    /// two different new things is how a mark stops meaning either.
    public static let newSession = "square.and.pencil"
    /// Clearing a finished Session off the roster — the control a row reveals when it is swiped.
    /// A box and not a bin: the Session is still there, behind the foot of the roster, and a
    /// trash mark would promise that it is not.
    public static let archive = "archivebox"
    /// Putting one back, from behind that foot. A container with the arrow coming OUT of it, so
    /// the pair reads as one act and its undo rather than as two unrelated verbs.
    public static let unarchive = "tray.and.arrow.up"
    /// The checkout a Project is on.
    public static let branch = "arrow.triangle.branch"
    /// A Session working in a checkout of its OWN rather than in the Project's. Two planes
    /// stacked, because that is what a worktree is — a second copy of the same repository beside
    /// the one everything else is looking at.
    public static let worktree = "square.on.square"
    /// Files changed and not yet committed. The same pencil the feed spends on an edit,
    /// deliberately: both marks mean a file was changed, and two marks for one meaning is how a
    /// reader learns that a mark means nothing in particular.
    public static let uncommitted = edited
    /// Commits made and not yet pushed — the arrow points the way they have not gone.
    public static let unpushed = "arrow.up"
    /// A reading that needs decoding once: the mark that opens the explanation beside it. An `i`
    /// rather than a `?` — what it opens is what these lines MEAN, not help with using the app.
    public static let about = "info.circle"
    /// The work carried on in a fresh Session: the mark on the link at the foot of the reading it
    /// was carried on FROM. It points the way the reader is being sent, which is why it is not the
    /// `delegated` turn-down arrow — a handoff is not work nested inside this Session's, it is this
    /// Session's work continuing beside it.
    public static let handedOff = "arrow.right.circle"
    /// The disclosure on a control that opens something BELOW it — a menu, a drawer under its
    /// vessel.
    public static let disclosure = "chevron.down"
    /// The disclosure on a control that opens something BESIDE it. A feed row's evidence lands in
    /// the panel to its right, and a chevron pointing down at a row that unfolds nothing promises
    /// the wrong gesture — the mark has to say which direction the content is in.
    public static let disclosureTrailing = "chevron.right"

    /// One mark per kind of call the feed can name. A call whose kind Argo could not read carries
    /// NO mark — there is no "unknown tool" symbol here on purpose, because a mark is a claim
    /// about what happened and that is the one case where nothing is known.
    public static let searched = "magnifyingglass"
    public static let read = "doc.text"
    public static let edited = "pencil"
    public static let created = "doc.badge.plus"
    public static let deleted = "trash"
    public static let moved = "arrow.right.doc.on.clipboard"
    public static let ran = "terminal"
    /// A skill the agent invoked by name — instructions it loaded, not a program on the machine,
    /// which is why it does not take the terminal.
    public static let skill = "wand.and.sparkles"
    public static let fetched = "globe"
    public static let delegated = "arrow.turn.down.right"
    public static let mcpTool = "puzzlepiece.extension"
    /// A folded run of looking. Its own mark rather than the one for a read or a search: the line
    /// stands for both of them at once, and borrowing either would name half of what it counts.
    public static let looked = "eye"
    // A call's outcome has no mark of its own. A failure is the line in the failure ink; success is
    // the default a feed may assume, and a tick on every row that worked marks the fourteen
    // ordinary
    // rows as loudly as the one that broke.

    /// A question put to somebody, waiting or settled. A bubble rather than a bare question mark:
    /// the mark is that somebody was ASKED, which is a thing said to a person and not a state.
    public static let asked = "questionmark.bubble"
    /// The option an answer named. The one tick in the feed, and it marks a CHOICE rather than a
    /// success — which is why the call lines still carry none.
    public static let chosen = "checkmark"
    /// A line of the record nothing could parse. Its own mark, and deliberately not a failure's:
    /// nothing went wrong with the agent's work here — the reader is the one that came up short,
    /// and a warning triangle over the row would report Argo's gap as the Session's.
    public static let unreadable = "questionmark.square.dashed"

    /// Closing the evidence panel.
    public static let dismiss = "xmark"

    /// Taking a step's address to the pasteboard — the one control beside a path in the panel. The
    /// platform's own copy mark, because a path copied out of Argo is going somewhere else, and a
    /// reader looking for it is looking for the glyph every other Mac app spends on this.
    public static let copyAddress = "doc.on.doc"
    /// A file outside the tree the Session is working in. An arrow leaving the box: what it says is
    /// WHERE the file is, which is the one thing a path relative to somewhere else cannot.
    public static let externalFile = "arrow.up.forward.square"

    /// Back to the newest thing in the feed, from wherever the reader scrolled to.
    public static let latest = "arrow.down"

    /// The composer's send: an arrow and no word, because "Send" beside an arrow beside a Return
    /// hint is one instruction three times.
    public static let send = "arrow.up"

    // The composer's Stop (#541) has no entry here, and the absence is the point: it is a drawn
    // square rather than a symbol, because no rung of the icon scale reaches the size the study
    // draws it at. The measurement lives with the vessel's own (`ArgoComposerVessel.stopMark`).

    /// The composer's attach control (#540). A `+` and deliberately not a paperclip: what it opens
    /// is "give the agent something", which is the same act as a drop and a paste, and a paperclip
    /// would name only one of the three.
    ///
    /// The same mark the drawer spends on registering a Project, which the `newSession` note above
    /// argues against — and earned here, because these two are the same verb at two altitudes
    /// rather than two different new things: both add one item to the list beside them.
    public static let attach = "plus"

    /// What an attachment's chip shows when it is not a picture, or when the bytes yield no
    /// thumbnail. Two marks only — a picture and everything else — because the chip already carries
    /// the file's name, and a mark per file type would be a second, worse spelling of the
    /// extension.
    public static let attachedImage = "photo"
    public static let attachedFile = "doc"

    /// A send the Session refused — on the seam, beside the reason. A triangle is earned here
    /// where the feed's rows never take one: this failure is Argo's to report about its own act,
    /// not a reading of the agent's work.
    public static let refused = "exclamationmark.triangle"

    /// Try the refused send again, with the message exactly where it was typed.
    public static let retry = "arrow.clockwise"

    /// A draft that survived leaving the Session — on the seam, beside how long ago it was
    /// written. A clock and not a document: what the line reports is the age, and the words
    /// themselves are already in the field underneath it.
    public static let draftKept = "clock"

    /// A Permission waiting on the user — the prompt's own mark. A lock, not a question mark,
    /// because the agent is not wondering: it is barred until somebody with the key answers.
    public static let permission = "lock.fill"

    /// What a file the panel is open on is written in — one mark per language FAMILY. The
    /// extension is in the path beside it and is what actually names the language; these say only
    /// which KIND of file you are looking at, which is what a glance at a header wants.
    ///
    /// Markup has no mark of its own on purpose. The nearest glyph to the chevrons is the SAME
    /// chevrons with one word different in the name, which in a column is not a second mark — it
    /// is the first one drawn twice.
    public static let swiftSource = "swift"
    public static let programSource = "chevron.left.forwardslash.chevron.right"
    public static let dataSource = "curlybraces"
    public static let proseSource = "text.alignleft"
    /// A file whose extension Argo does not recognise, and anything the panel opens on that is not
    /// a file at all.
    public static let plainSource = "doc"

    /// Switching the panel between the patch the record carries and the document that patch made.
    /// One control, carrying the mark of where it goes — so the two are never on screen together.
    /// Going back to the patch is going back to source, and it takes the source mark rather than a
    /// second glyph meaning the same thing.
    public static let readAsSource = programSource
    public static let readAsProse = "doc.richtext"

    /// Where a step of the plan has got to. Three marks for three states, and the SHAPE carries
    /// the reading on its own: an empty ring is untouched, a half-filled one is under way, a tick
    /// is behind the agent. Colour says the same thing a second time for the step in progress and
    /// nothing at all for the other two — a list where every finished step is green is a list with
    /// nothing standing out in it.
    public static let stepPending = "circle"
    public static let stepInProgress = "circle.lefthalf.filled"
    public static let stepCompleted = "checkmark.circle.fill"
}
