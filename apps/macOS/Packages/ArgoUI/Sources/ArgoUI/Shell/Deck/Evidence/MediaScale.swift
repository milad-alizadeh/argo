import CoreGraphics

/// The density decoded pictures are made at.
enum MediaScale {
    /// The DENSEST display attached, not the main one, and read once.
    ///
    /// A window on a Retina panel beside a 1× display set as the main one would otherwise decode
    /// at half the pixels it draws — soft for the life of the process, with no cache miss ever
    /// correcting it, since a decode is only remade for a larger BOX and the box does not change
    /// when the window moves. Over-sampling on the 1× display costs one thumbnail's pixels.
    static let display = densest(of: attached())

    /// Two where there is no display to ask — the denser answer, so nothing is drawn soft the
    /// moment one appears, and the same guess `MinimapLaneView.backingScale` makes for the same
    /// reason.
    static func densest(of scales: [CGFloat]) -> CGFloat {
        scales.max() ?? 2
    }

    /// Every active display's backing scale, through CoreGraphics rather than `NSScreen`, which is
    /// main-actor work and this is read from wherever a picture is first drawn.
    private static func attached() -> [CGFloat] {
        var count: UInt32 = 0
        guard CGGetActiveDisplayList(0, nil, &count) == .success, count > 0 else { return [] }
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        guard CGGetActiveDisplayList(count, &ids, &count) == .success else { return [] }
        return ids.compactMap { id in
            guard let mode = CGDisplayCopyDisplayMode(id), mode.width > 0 else { return nil }
            return CGFloat(mode.pixelWidth) / CGFloat(mode.width)
        }
    }
}
