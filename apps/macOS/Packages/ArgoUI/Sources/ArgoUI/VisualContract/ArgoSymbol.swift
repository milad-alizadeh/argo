/// The SF Symbols the shell draws, named for what they mean rather than for what they look like.
///
/// A symbol is a token like a colour is: one place decides which mark stands for a Project, so the
/// vessel and the drawer cannot drift into two marks for one thing. Size is not decided here — see
/// `ArgoTextStyle.glyphSize`, which scales a mark to the label it sits on.
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
    /// The disclosure on a control that opens something.
    public static let disclosure = "chevron.down"
}
