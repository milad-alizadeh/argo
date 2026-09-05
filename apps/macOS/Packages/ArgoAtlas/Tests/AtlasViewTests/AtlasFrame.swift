@testable import AtlasLayout

/// One drawn frame, read back: what a reader actually sees.
///
/// Only the picture. What a pick ANSWERS is asked of the renderer itself
/// (`AtlasPickHarness.pick(at:)`), because that is the call a hover makes — a test that read the id
/// texture straight would be skipping the resolve, the roster and the bounds check that stand
/// between the target and a name.
struct AtlasFrame {
    /// BGRA, one byte a channel, in the drawable's own order.
    let colour: [UInt8]

    /// The band a pixel is PAINTED in, read off the picture alone.
    ///
    /// A band or nothing, never a nearest guess: the light model is a scalar multiply on a band's
    /// own pigment (#1151), so a lit face keeps its band's HUE exactly and every grey on the map —
    /// the desktop, the plates, their rims, the shadow decals — keeps a hue no band has. That is
    /// what makes the picture readable back to a band without eyedropping a tolerance on value.
    func band(atPixel index: Int) -> AtlasBand? {
        let blue = Double(colour[index * 4]) / 255
        let green = Double(colour[index * 4 + 1]) / 255
        let red = Double(colour[index * 4 + 2]) / 255
        return AtlasHue(red: red, green: green, blue: blue).band
    }
}
