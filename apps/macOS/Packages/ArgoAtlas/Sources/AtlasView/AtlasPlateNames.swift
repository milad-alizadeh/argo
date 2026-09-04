import ArgoDesign
import AtlasLayout
import SwiftUI

/// Every folder's name, drawn in the strip its plate kept for it (#1147).
///
/// SwiftUI rather than the shader beneath it, because this is the one part of the map a GPU has no
/// cheap answer for: a name that does not fit has to be MEASURED before it can be elided, and
/// eliding is the whole requirement — a name allowed to overflow runs across the files on the
/// plate next door and reads as a label on them.
struct AtlasPlateNames: View {
    @Environment(\.argo) private var argo

    let plates: [AtlasPlateFrame]

    /// What the name keeps between itself and the plate's own edge, on both sides.
    ///
    /// The strip already sits inside the plate's ring, which is the tiler's arithmetic and is
    /// about the tiling rather than about type. This is the type's own: a name starting on the
    /// edge reads as part of the border rather than as a label on the ground inside it.
    private static let sideRoom = ArgoSpacing.tight

    var body: some View {
        ForEach(plates, id: \.path) { plate in
            let strip = Self.room(in: plate.nameStrip)
            if plate.carriesName {
                Text(plate.name)
                    // The interface face, not the machine one: a plate's name is a folder as the
                    // reader thinks of it, and the approved render sets it in the proportional
                    // face at the smallest semibold weight the contract has. The legend beside it
                    // is where the machine face belongs, because every string in it is a number.
                    .argoText(ArgoTypography.badge)
                    .foregroundStyle(argo.color.text.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(width: strip.width, height: strip.height, alignment: .leading)
                    .position(x: strip.midX, y: strip.midY)
            }
        }
    }

    /// The strip the name is actually set in: the plate's, less the side room, and never past
    /// nothing. `CGRect.insetBy` answers a NULL rectangle once the inset eats the whole width, and
    /// a null rectangle's midpoint is infinite — which puts the name off the window rather than
    /// eliding it to a plate too narrow to hold one.
    private static func room(in strip: CGRect) -> CGRect {
        let side = min(sideRoom, strip.width / 2)
        return CGRect(
            x: strip.minX + side,
            y: strip.minY,
            width: strip.width - side * 2,
            height: strip.height,
        )
    }
}
