/// The two ways a sweep can place a transcript in a Project: by the working directory the file
/// reports, and — where it reports none — by the directory the CLI filed it in.
struct ProjectAddress {
    /// What every readable `cwd` is compared against.
    let root: SpelledPath
    /// What the CLI would have called this Project's record directory, over both spellings of the
    /// root. Empty for a CLI that files no such directory, and for the filesystem root.
    let recordDirectoryNames: Set<String>
}
