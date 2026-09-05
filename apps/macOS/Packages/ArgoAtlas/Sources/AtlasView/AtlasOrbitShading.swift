import ArgoDesign
import AtlasLayout
import CoreGraphics
import Foundation
import simd

/// Where the model's own axes land on the screen at one orientation: right, up, and toward the
/// eye. The same rotation `AtlasCamera` applies, written as an orthonormal basis instead of as a
/// projection, because the ball turns a unit sphere rather than a plan (`docs/designs/
/// cockpit-atlas.html`, `orbBasis`).
struct AtlasOrbitBasis: Equatable {
    let right: SIMD3<Double>
    let up: SIMD3<Double>
    let toward: SIMD3<Double>

    init(_ orientation: AtlasOrientation) {
        let cosYaw = cos(orientation.yaw), sinYaw = sin(orientation.yaw)
        let cosPitch = cos(orientation.pitch), sinPitch = sin(orientation.pitch)
        self.right = SIMD3(cosYaw, -sinYaw, 0)
        self.up = SIMD3(sinYaw * sinPitch, cosYaw * sinPitch, cosPitch)
        self.toward = SIMD3(-sinYaw * cosPitch, -cosYaw * cosPitch, sinPitch)
    }

    /// One vector of the model, on the screen: x right, y up, z toward the reader.
    func screen(_ vector: SIMD3<Double>) -> SIMD3<Double> {
        SIMD3(dot(right, vector), dot(up, vector), dot(toward, vector))
    }

    /// How high in the MODEL a screen-space direction points — the basis read the other way round,
    /// which is what lets the sky term be spent on a normal the shading already holds in screen
    /// space. `right.z` is zero at every orientation, so it is not written.
    func height(of screenDirection: SIMD3<Double>) -> Double {
        screenDirection.y * up.z + screenDirection.z * toward.z
    }
}

/// The orbit ball, shaded: a lit sphere of the map's own neutral pigment under the map's own lamps,
/// with the plan the city stands on drawn through it (#1152, and the design's own `#orbc`).
///
/// A solid rather than a wireframe globe, and the reason is in the design: the map is a lit solid
/// on near-black, so the handle is one too. The lamps are fixed in the MODEL, so the highlight
/// travels as the reader turns the ball — the control is lit by the light it controls, which is
/// what makes it read as the same city rather than as an icon of one.
///
/// Pure, and separate from the view that draws it, for `AtlasLighting`'s reason: what the pixels
/// come out as is decided by this type's input alone, so it can be asserted on without a window.
struct AtlasOrbitShading {
    /// The design's own sky share: the ambient lift a normal takes for pointing up in the model.
    private static let skyShare = 0.16
    /// A corner of the plan square, as a share of the radius. A corner rather than a side has to
    /// land inside the silhouette, which is what holds it below one.
    private static let planShare = 0.64

    let basis: AtlasOrbitBasis
    /// What the ball is painted in: the pigment a file with no Measure is drawn in — the map's own
    /// way of saying "neutral", so the handle claims no band.
    let pigment: ArgoColor

    init(orientation: AtlasOrientation, pigment: ArgoColor) {
        self.basis = AtlasOrbitBasis(orientation)
        self.pigment = pigment
    }

    /// The lit disc, `diameter` pixels across and transparent outside its own silhouette.
    ///
    /// Per pixel rather than per gradient stop: a sphere lit by two directional lamps has no radial
    /// symmetry to build a gradient out of once the key is off-axis, and the whole point of the
    /// widget is that the highlight moves off-centre as the model turns.
    func ball(diameter: Int) -> CGImage? {
        let radius = Double(diameter) / 2
        let key = basis.screen(normalize(ArgoLight.key.direction))
        let fill = basis.screen(normalize(ArgoLight.fill.direction))
        var pixels = [UInt8](repeating: 0, count: diameter * diameter * 4)

        for row in 0 ..< diameter {
            let down = (Double(row) + 0.5) / radius - 1
            for column in 0 ..< diameter {
                let across = (Double(column) + 0.5) / radius - 1
                let square = across * across + down * down
                guard square < 1 else { continue }
                // Screen y runs DOWN and the normal's does not, which is the one flipped sign.
                let normal = SIMD3(across, -down, (1 - square).squareRoot())
                let lit = pigment.scaled(by: ArgoLight.orbDim * factor(
                    at: normal,
                    key: key,
                    fill: fill,
                ))
                // One pixel of feather at the rim, so a 54-point disc has no staircase on it.
                let alpha = min(1, (1 - square.squareRoot()) * radius)
                write(lit, alpha: alpha, into: &pixels, at: (row * diameter + column) * 4)
            }
        }
        return Self.image(from: pixels, diameter: diameter)
    }

    /// The floor the city stands on, seen through the ball: yaw turns the square, pitch opens and
    /// closes it, so the handle shows the two angles as the shape already on screen. Each corner
    /// comes back with how far toward the reader it sits, which is what the near edges are drawn
    /// brighter by.
    func planCorners(radius: Double) -> [(point: CGPoint, depth: Double)] {
        [SIMD2(1.0, 1.0), SIMD2(-1.0, 1.0), SIMD2(-1.0, -1.0), SIMD2(1.0, -1.0)].map { corner in
            let turned = basis.screen(SIMD3(corner.x, corner.y, 0))
            return (
                CGPoint(
                    x: radius + turned.x * radius * Self.planShare,
                    y: radius - turned.y * radius * Self.planShare,
                ),
                turned.z,
            )
        }
    }

    /// What one normal is lit by, as a SCALAR — `ArgoLight`'s absolute rule, the same way
    /// `AtlasLighting` spends it: a lamp's tint becomes its luminance before it ever meets a
    /// pigment, so a lit face is the swatch darker or brighter and never a different hue.
    private func factor(
        at normal: SIMD3<Double>,
        key: SIMD3<Double>,
        fill: SIMD3<Double>,
    )
        -> Double {
        let keyed = max(0, dot(normal, key)) * AtlasLighting.strength(of: ArgoLight.key)
        let filled = max(0, dot(normal, fill)) * AtlasLighting.strength(of: ArgoLight.fill)
        let sky = max(0, basis.height(of: normal)) * Self.skyShare * AtlasLighting
            .tone(ArgoLight.fill.tint)
        return AtlasLighting.strength(of: ArgoLight.ambient) + keyed + filled + sky
    }

    /// Premultiplied, because that is what `premultipliedLast` means: a rim pixel written at full
    /// value under a low alpha composites as a bright ring nobody drew.
    private func write(
        _ colour: ArgoColor,
        alpha: Double,
        into pixels: inout [UInt8],
        at offset: Int,
    ) {
        pixels[offset] = UInt8(min(255, (colour.red * alpha * 255).rounded()))
        pixels[offset + 1] = UInt8(min(255, (colour.green * alpha * 255).rounded()))
        pixels[offset + 2] = UInt8(min(255, (colour.blue * alpha * 255).rounded()))
        pixels[offset + 3] = UInt8(min(255, (alpha * 255).rounded()))
    }

    private static func image(from pixels: [UInt8], diameter: Int) -> CGImage? {
        guard let provider = CGDataProvider(data: Data(pixels) as CFData) else { return nil }
        return CGImage(
            width: diameter, height: diameter,
            bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: diameter * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent,
        )
    }
}
