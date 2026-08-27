import SwiftUI

/// What the Connect panel and the device-code card inside it are measured at. Both are content
/// MEASURES — a panel sized to its longest row, and a slot sized to the code it holds still.
public enum ArgoConnectPanel {
    /// Wide enough for a row naming a provider, an identity and a scope on one line, and no wider.
    public static let width: CGFloat = 560
    /// The device code's own line. A fixed slot rather than the code's intrinsic width: a slot
    /// that resized with the code would move the button under it.
    public static let deviceCodeWidth: CGFloat = 200
}
