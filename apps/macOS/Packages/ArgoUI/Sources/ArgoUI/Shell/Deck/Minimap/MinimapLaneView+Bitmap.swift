import AppKit

// The one place the lane makes pixels. Both halves rasterise into a `CGImage` handed to a layer
// rather than drawing in `draw(_:)`, because what the lane must never do is repaint on a scroll —
// and a layer holding an image does not.

extension MinimapLaneView {
    /// A bitmap at the display's own backing scale, in LANE coordinates: the origin at the top left
    /// and y counting down, as the reading does.
    ///
    /// AppKit is told the context is flipped as well as flipping it, so an `NSAttributedString`
    /// drawn into it lands right side up rather than mirrored.
    func flipped(_ size: CGSize, scale: CGFloat, _ draw: (CGContext) -> Void) -> CGImage? {
        guard size.width > 0, size.height > 0,
              let context = CGContext(
                  data: nil,
                  width: Int(size.width * scale),
                  height: Int(size.height * scale),
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue,
              )
        else {
            return nil
        }
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
        draw(context)
        NSGraphicsContext.restoreGraphicsState()
        return context.makeImage()
    }
}
