import Foundation

/// Every skill installed for one Project, read where the main actor is not (#961).
///
/// An `actor` for `PathResolver`'s reason (ADR-0028 Rule 6): the walk opens a directory per origin,
/// a `SKILL.md` per skill and two JSON files, and its caller is the composer — which draws the
/// caret. `SkillCatalog` is internal to this module, so nothing in `ArgoUI` or the app target can
/// reach the synchronous walk at all: omitting the `await` is a build failure rather than a review
/// note.
///
/// Stateless, and nothing here is cached. WHEN to walk again belongs to the caller, which is the
/// only place that knows what a stale list would cost — for the composer, one walk per `/` menu
/// opening rather than one per keystroke.
public actor SkillReading {
    private let homeURL: URL

    /// The user's own skills folder. A value the caller supplies, for `SkillCatalog`'s reason — the
    /// CLI owns this directory and Argo only reads it — and so a test never reads this machine's.
    public init(homeURL: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.homeURL = homeURL
    }

    public func skills(forProjectAt projectURL: URL) -> [Command] {
        SkillCatalog(projectURL: projectURL, homeURL: homeURL).skills()
    }
}
