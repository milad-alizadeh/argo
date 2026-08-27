import SwiftUI

/// Stroke widths. Every one of them is an edge, which is how depth is built here.
public enum ArgoStroke {
    /// A separator between two surfaces of the same tone.
    public static let hairline: CGFloat = 0.5
    /// A control border.
    public static let border: CGFloat = 1
    /// The Ion Blue selection edge on a row or a tab.
    public static let indicator: CGFloat = 2
    /// The keyboard focus ring.
    public static let focus: CGFloat = 2
    /// The dash a broken edge is drawn with: a Project whose folder is not there.
    public static let dash: CGFloat = 3
}
