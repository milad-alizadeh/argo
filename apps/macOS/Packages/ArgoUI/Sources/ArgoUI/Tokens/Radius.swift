import CoreGraphics

/// A doubling from the hair to the plane.
public enum Radius {
    public static let hair: CGFloat = 2
    public static let small: CGFloat = 4
    public static let medium: CGFloat = 8
    public static let large: CGFloat = 12
    public static let plane: CGFloat = 16
    /// Pills and chips.
    public static let full: CGFloat = 999
    /// The severity/state accent bar on a finding, a review row, a phase group.
    public static let rosterBorder: CGFloat = 3
}
