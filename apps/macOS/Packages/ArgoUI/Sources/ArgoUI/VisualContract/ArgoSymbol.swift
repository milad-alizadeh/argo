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
    /// The checkout a Project is on.
    public static let branch = "arrow.triangle.branch"
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
    public static let fetched = "globe"
    public static let delegated = "arrow.turn.down.right"
    public static let mcpTool = "puzzlepiece.extension"
    /// A call that failed. It replaces the kind's own mark rather than tinting it: colour alone is
    /// a difference a reader who cannot see it loses entirely, and on a row that no longer prints
    /// what went wrong, the mark is half of what says anything did.
    public static let callFailed = "exclamationmark.triangle"

    /// Closing the evidence panel.
    public static let dismiss = "xmark"
}
