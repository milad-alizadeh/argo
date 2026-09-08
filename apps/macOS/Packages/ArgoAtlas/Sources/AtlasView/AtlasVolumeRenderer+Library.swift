import AtlasLayout
import MetalKit

/// Whether this machine can draw the map, out of which file, and at how many samples — the
/// questions that come before "how is the map drawn".
extension AtlasVolumeRenderer {
    /// How many samples a pixel is resolved from. Every edge in this picture is a box's own
    /// silhouette against whatever stands behind it — there is no texture and no wireframe to hide
    /// a staircase in — so at one sample a roof's diagonal far edge is drawn as a run of whole
    /// pixels, and a city of a few thousand of them reads as ragged rather than as flat quads
    /// (#1400). Four is the count every Metal device on this platform supports; `sampleCount(on:)`
    /// asks the device rather than assuming, for the reason every other failure here is a `nil`.
    nonisolated static let preferredSampleCount = 4

    /// What this device will actually resolve a pixel from. `AtlasSamplingTests` is what holds it
    /// to `preferredSampleCount`.
    nonisolated static func sampleCount(on device: MTLDevice) -> Int {
        device.supportsTextureSampleCount(preferredSampleCount) ? preferredSampleCount : 1
    }

    /// Whether this machine can draw the map at all: a Metal device, and this package's shader
    /// compiled into its own bundle. The same two `init` fails on, asked without building a
    /// pipeline — and `nonisolated`, because the one caller is a suite trait, evaluated before
    /// there is a main actor to ask on (`AtlasPickHarness`).
    nonisolated static var isSupported: Bool {
        guard let device = MTLCreateSystemDefaultDevice(), let library = library(on: device)
        else { return false }
        return library.makeFunction(name: "atlas_volume_vertex") != nil
    }

    /// `AtlasVolume.metal`, however this build has it.
    ///
    /// Xcode compiles it into the target's `default.metallib`, which is what the shipped app loads.
    /// SwiftPM does not compile Metal at all — the manifest says so — and carries the SOURCE in the
    /// bundle instead, so a `swift test` binary and a Mac with no Metal Toolchain compile it here,
    /// at runtime, out of the same file. That is what lets `AtlasPickingTests` render the map the
    /// app renders rather than a second drawing of it written in Swift; without it the one claim
    /// #1153 makes could only be asserted by a suite that skipped itself.
    /// Cached like `Bundle.module` itself: the filesystem does not move mid-process for a bundle
    /// that resolved once, and a bundle that vanished stays vanished for this process's purposes.
    /// `internal` rather than `private`, and only because this is an extension in a second file:
    /// `init` reads it from the renderer's own, and `private` at type scope reaches no further
    /// than the file the type is declared in.
    nonisolated static let resourceBundle: Bundle? =
        ModuleResourceBundle.resolve(bundleName: "ArgoAtlas_AtlasView")

    /// `internal` for `resourceBundle`'s reason.
    nonisolated static func library(on device: MTLDevice) -> MTLLibrary? {
        guard let bundle = resourceBundle else { return nil }
        if let prebuilt = try? device.makeDefaultLibrary(bundle: bundle) {
            return prebuilt
        }
        return try? compiled(on: device)
    }

    /// The same shader compiled from the SOURCE in the bundle — the SwiftPM path, and the one a
    /// `swift test` binary takes.
    ///
    /// It THROWS where `library(on:)` answers nothing, and that is the whole reason it is a
    /// separate call: every rendering suite in this package is gated on the shader having its
    /// functions, so a `AtlasVolume.metal` that stopped compiling turns all of them green by
    /// SKIPPING — a `nil` saying "no Metal on this machine" where the truth is "this file is
    /// broken". #1600 lost a round to exactly that. `AtlasShaderTests` is what reds instead.
    nonisolated static func compiled(on device: MTLDevice) throws -> MTLLibrary? {
        guard let bundle = resourceBundle,
              let url = bundle.url(forResource: "AtlasVolume", withExtension: "metal"),
              let source = try? String(contentsOf: url, encoding: .utf8)
        else { return nil }
        return try device.makeLibrary(source: source, options: nil)
    }
}
