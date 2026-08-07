import SwiftUI

/// The core ramps — the only literal colour values in the app.
///
/// Layer 1 of the token contract, carried over from `argo-tokens.css` unchanged: these are
/// the same seven ramps the Electron cockpit is drawn from, so the two renderings of Argo
/// cannot drift into two palettes. A step is never used directly by a view; `Palette` binds
/// each one to a job, and views name the job.
///
/// Higher number = darker for graphite, and = deeper ink for every chromatic ramp. That is
/// the CSS's orientation, kept so a value can be compared across the two files by eye.
enum Ramp {
    // Graphite — the scene and its surfaces. Cool-biased near-blacks.
    static let graphite400 = Color(hex: 0x3B3E46)
    static let graphite500 = Color(hex: 0x26282E)
    static let graphite600 = Color(hex: 0x1C1D23)
    static let graphite700 = Color(hex: 0x101218)
    static let graphite800 = Color(hex: 0x0C0D10)
    /// The locked Penumbra base.
    static let graphite850 = Color(hex: 0x0A0B0D)
    static let graphite900 = Color(hex: 0x08090B)
    static let graphite950 = Color(hex: 0x070709)

    // Bone — the warm inks that read on graphite.
    static let bone50 = Color(hex: 0xF6F2E9)
    static let bone100 = Color(hex: 0xF2EDE2)
    static let bone200 = Color(hex: 0xE7E3DA)
    static let bone300 = Color(hex: 0xDAD5C9)
    static let bone400 = Color(hex: 0xC6C1B5)
    static let bone500 = Color(hex: 0x9A968C)
    static let bone600 = Color(hex: 0x7C786F)
    static let bone700 = Color(hex: 0x615E58)

    // Eclipse gold — the single accent, and `needs you`.
    static let gold300 = Color(hex: 0xDFC591)
    static let gold500 = Color(hex: 0xC8A968)
    static let gold600 = Color(hex: 0xA5854A)
    static let gold700 = Color(hex: 0x8A7038)

    // Monolith teal — running.
    static let teal300 = Color(hex: 0x8FC0AB)
    static let teal500 = Color(hex: 0x6FA890)
    static let teal600 = Color(hex: 0x4E8570)
    static let teal700 = Color(hex: 0x3F6E5B)

    // Moss — approve, and a diff addition. Duller than teal on purpose, so a running dot
    // and an added line never read as the same green.
    static let moss300 = Color(hex: 0x8FBF9C)
    static let moss500 = Color(hex: 0x5C8A6B)
    static let moss600 = Color(hex: 0x4A7357)
    static let moss700 = Color(hex: 0x3E6349)

    // Terracotta — failed, blocked, a diff deletion. A muted red: the scene has no
    // saturated alarm colour.
    static let terracotta300 = Color(hex: 0xD08C83)
    static let terracotta500 = Color(hex: 0xB5675E)
    static let terracotta600 = Color(hex: 0x9A5249)
    static let terracotta700 = Color(hex: 0x8A4A43)

    // Slate — done, and stale. Quiet by design: finished work leaves the eye.
    static let slate300 = Color(hex: 0x97A0AB)
    static let slate500 = Color(hex: 0x5B6673)
    static let slate600 = Color(hex: 0x4A5460)
    static let slate700 = Color(hex: 0x3E4650)
}

extension Color {
    /// The one place a hex literal is read. Confined to this file so the design-token check
    /// can say "a hex outside Tokens/ is a value that escaped the contract" and be right.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1,
        )
    }
}
