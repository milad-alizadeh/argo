import SwiftUI

/// What the roster's archive header is measured at.
public enum ArgoRosterFoot {
    /// A FLOOR, not a height: macOS scales sidebar row height with the reader's own sidebar size
    /// setting, and a frame here would refuse it
    /// (`docs/designs/cockpit-roster-archive-foot.md`).
    public static let minimumHeight: CGFloat = 22
}
