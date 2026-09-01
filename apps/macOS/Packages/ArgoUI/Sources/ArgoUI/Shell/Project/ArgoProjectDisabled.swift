import SwiftUI

/// What the disabled-Project state is measured at. A content MEASURE, beside the surface it
/// belongs to rather than in the contract (#756): it is the width of a sentence, not a step of a
/// rhythm.
public enum ArgoProjectDisabled {
    /// A ceiling on the prose, not a panel: the state is drawn on the window's own ground with
    /// nothing around it, and a recorded path run across a 1280pt window is a line nobody reads to
    /// the end of.
    public static let readingWidth: CGFloat = 420
}
