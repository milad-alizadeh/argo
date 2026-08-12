import Foundation

/// Words for the lane's arithmetic to divide, where a test cares how MANY there are and not what
/// they say. One character per unit of length, so a shape's length is the number asked for.
enum MinimapText {
    static func words(_ length: Int) -> String {
        String(repeating: "a", count: max(0, length))
    }
}
