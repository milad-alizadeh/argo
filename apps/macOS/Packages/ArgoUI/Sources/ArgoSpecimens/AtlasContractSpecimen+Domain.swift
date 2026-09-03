import ArgoDesign
import ArgoUI
import SwiftUI

/// The domain wheel, which is a RULE and so has no `all` to reflect: the only way to look at it is
/// to run it at the counts a repository can hand it and draw what comes out.
extension AtlasContractSpecimen {
    var domains: some View {
        section("Domains — hue carries identity, saturation carries confidence") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                ForEach(Self.counts, id: \.self) { count in
                    wheel(count)
                }
                confidence
                swatches(unnamedRegions)
            }
        }
    }

    /// Three counts: what a small repository, this one and a large one come out as. They are drawn
    /// touching and unlabelled, because that is the judgement — at 30 the hues stop being tellable
    /// apart, which is why every region on the map carries its name.
    private func wheel(_ count: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("\(count) domains")
            HStack(spacing: ArgoSpacing.flush) {
                ForEach(Array(argo.color.atlas.domain.wheel(count: count).enumerated()), id: \.0) {
                    Rectangle().fill($0.element).frame(width: 420 / CGFloat(count), height: 30)
                }
            }
        }
    }

    /// One domain at five confidences. Washed out means unsure, and the two readings are one
    /// continuum — so what has to be judged here is that the low end still reads as the same
    /// domain rather than as a second grey.
    private var confidence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("confidence 0 → 1")
            HStack(spacing: ArgoSpacing.tight) {
                ForEach(Self.confidences, id: \.self) { held in
                    AtlasSwatch(
                        name: "\(Int(held * 100))%",
                        color: argo.color.atlas.domain.hue(3, confidence: held),
                    )
                }
            }
        }
    }

    /// The two readings that are not a domain, drawn beside the wheel because that is where they
    /// are read: a region belonging to nothing, and a region that is not the one being looked at.
    private var unnamedRegions: [(name: String, color: ArgoColor)] {
        [
            ("unassigned", argo.color.atlas.materials.unassigned),
            ("hushed", argo.color.atlas.materials.hushed),
        ]
    }

    /// A small repository, this one, and one past the count where a hue stops being an identifier.
    private static let counts = [8, 17, 30]
    private static let confidences: [Double] = [0, 0.25, 0.5, 0.75, 1]
}
