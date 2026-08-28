import Foundation

/// Which screens one Project has settled a design for, named the way a Ticket names them (#899).
///
/// This is the tree half of the command mapping's rule 1 — a UI Ticket whose screen has a design is
/// built with `design-to-code` and never with `implement` (`AGENTS.md`, the design route). No label
/// can carry that fact, because it is a property of the checkout rather than of the Ticket.
///
/// Nothing is cached, for `SkillCatalog`'s reason: a design landed while the app is open is in the
/// very next answer.
public struct DesignedScreens {
    /// Where a settled design lives, relative to the Project's root (`rules/designs.md`).
    static let folder = "docs/designs"
    /// What a study's file name begins with. The studies here are all of one app's cockpit, so the
    /// prefix is what separates a screen's study from the index and the reference shots beside it.
    private static let study = "cockpit-"

    private let projectURL: URL

    public init(projectURL: URL) {
        self.projectURL = projectURL.standardizedFileURL
    }

    public func screens() -> Set<String> {
        let designs = projectURL.appending(path: Self.folder)
        let entries = try? FileManager.default
            .contentsOfDirectory(atPath: designs.path(percentEncoded: false))
        return Set((entries ?? []).compactMap(Self.screen(of:)))
    }

    /// The screen one entry of that folder settles, and `nil` where it settles none.
    ///
    /// A screen is settled by its STUDY — `cockpit-<screen>.md` — and by nothing else. The renders
    /// beside it are named for the study rather than the other way round, and counting the folders
    /// too would settle `renders` and `prototypes`, which are screens nobody ever drew.
    ///
    /// A study is `cockpit-<screen>` and then anything before `.md` — `.inventory.md` is the same
    /// screen — so the name ends at its FIRST dot rather than at the path extension.
    static func screen(of entry: String) -> String? {
        guard entry.hasSuffix(".md"), entry.hasPrefix(study),
              let dot = entry.firstIndex(of: ".") else { return nil }
        return String(entry[entry.index(entry.startIndex, offsetBy: study.count) ..< dot])
    }
}
