import SwiftUI

/// A polyline, built. Its own type so every node shape and every connector draw through one.
enum MermaidPath {
    static func through(_ points: [CGPoint], closed: Bool = false) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() {
            path.addLine(to: point)
        }
        if closed {
            path.closeSubpath()
        }
        return path
    }
}
