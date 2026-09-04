import SwiftUI

/// The spacing rhythm. Dense by design: the cockpit shows many Sessions at once.
public enum ArgoSpacing {
    public static let flush: CGFloat = 0
    public static let hair: CGFloat = 2
    public static let tight: CGFloat = 4
    public static let snug: CGFloat = 6
    public static let base: CGFloat = 8
    public static let comfortable: CGFloat = 12
    public static let loose: CGFloat = 16
    public static let section: CGFloat = 24
    public static let region: CGFloat = 32

    public static let all: [(name: String, value: CGFloat)] = [
        ("flush", flush), ("hair", hair), ("tight", tight), ("snug", snug), ("base", base),
        ("comfortable", comfortable), ("loose", loose), ("section", section), ("region", region),
    ]

    /// The gap between marks in the roster's Subagent stack (`SubagentDots`,
    /// `cockpit-roster-row.md`). Off the rhythm ladder and tighter than `hair` would read at this
    /// scale: the stack has to read as one column, not as a list.
    public static let subagentGap: CGFloat = 3
}
