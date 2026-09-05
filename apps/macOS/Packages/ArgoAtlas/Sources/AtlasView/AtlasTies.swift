import ArgoDesign
import AtlasLayout
import CoreGraphics

/// What the map draws of the co-change counting (#1160): every tie it has, and whether the reader
/// asked for the strongest of them across the whole picture.
///
/// The whole list rather than the chosen hundred and sixty, because the map draws two readings off
/// it — the strongest across the map, and the pinned file's own — and a caller that chose one of
/// them here would have to choose the other one too, in a column that does not know what is
/// pinned.
///
/// The couplings are the DRAWN Map's, which is what makes hiding test files take their cords with
/// them: `AtlasMapChoice.drawn` re-reads the repository without those files, ties and all.
public struct AtlasTies: Equatable, Sendable {
    /// Every tie the drawn Map carries.
    public let couplings: [AtlasCoupling]

    /// Whether Strongest ties is on. It governs the whole-map reading only: a pinned file draws
    /// its own however this is set, because the reader pointed at a file and asked a question the
    /// switch does not answer.
    public let isOn: Bool

    public init(couplings: [AtlasCoupling], isOn: Bool) {
        self.couplings = couplings
        self.isOn = isOn
    }

    /// A map with no ties to draw and no switch to draw them with: every preview and every
    /// specimen of the drawing alone takes this, the way they take `AtlasFocus.none`.
    public static let none = AtlasTies(couplings: [], isOn: false)
}

/// How brightly one cord is drawn, which is the whole difference between the two readings.
///
/// The pinned file's own answer a question the reader just asked, so they are the heavier; the
/// strongest across the map are a texture over the whole picture, and at the pinned weight a
/// hundred and sixty of them would be the only thing on the frame.
enum AtlasCordWeight: Equatable {
    /// One of the strongest across the whole map, drawn because the switch is on.
    case acrossTheMap
    /// One of the pinned file's own.
    case ofThePinnedFile

    /// The share of the cord's own colour it is drawn at, before its strength is spent on top —
    /// the approved render's own two numbers (`docs/designs/cockpit-atlas.html`, `filaments`).
    var alpha: Double {
        switch self {
        case .acrossTheMap: 0.3
        case .ofThePinnedFile: 0.95
        }
    }

    /// What the cord is stroked at before its strength widens it. The two rungs of the contract
    /// nearest the render's own 1 and 1.9, so the map's weights are the app's rather than two
    /// numbers of the Atlas's own.
    var width: CGFloat {
        switch self {
        case .acrossTheMap: ArgoStroke.border
        case .ofThePinnedFile: ArgoStroke.indicator
        }
    }
}
