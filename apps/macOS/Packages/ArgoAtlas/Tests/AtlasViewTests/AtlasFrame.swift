import ArgoDesign
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
        pixel(at: index).band
    }

    /// How bright one pixel came out, in the frame's own 0-255 (#1600).
    ///
    /// The other half of reading a frame back: the band is what a pixel is PAINTED in, and this is
    /// what the light and the grain spent on it. Rec. 709, the same three weights every other
    /// luminance in this contract is read on.
    func light(atPixel index: Int) -> Double {
        let read = pixel(at: index)
        let weights = ArgoColor.rec709Weights
        return (weights.red * read.red + weights.green * read.green
            + weights.blue * read.blue) * 255
    }

    /// One pixel as three channels again, out of the drawable's own BGRA order.
    private func pixel(at index: Int) -> AtlasHue {
        AtlasHue(
            red: Double(colour[index * 4 + 2]) / 255,
            green: Double(colour[index * 4 + 1]) / 255,
            blue: Double(colour[index * 4]) / 255,
        )
    }
}

extension ArgoColor {
    /// How bright this colour reads on a frame's own scale, so a claim about a pixel can be made
    /// against the tone it was supposed to be drawn in (#1600).
    var frameLight: Double {
        let weights = ArgoColor.rec709Weights
        return (weights.red * red + weights.green * green + weights.blue * blue) * 255
    }
}
