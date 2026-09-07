import ArgoDesign
import AtlasLayout
import Foundation
import SwiftUI

/// The key the DOMAIN map is read with (#1158): the largest regions in the colours they are drawn
/// in, the grey that belongs to nothing, and the sentence that says nobody confirmed any of it.
///
/// A view of its own rather than a mode of `AtlasLegendKey`, because the two keys answer different
/// questions and share nothing but a place in the column. That one prints VALUES at the ends of a
/// continuous ramp; this one prints COUNTS at the ends of a set of categories, and there is no
/// ramp — a run of hues with no order is not a gradient, and drawing one would claim a domain is
/// more of something than its neighbour.
///
/// **The word `inferred` is in the key itself**, not only in the sentence under it. A reader who
/// takes in one line of a legend has to take in the tier: every other number on this map is
/// measured, and these are guessed.
public struct AtlasDomainKey: View {
    /// The Domains, largest first — the inference's own order, which is the order their colours
    /// are ranked in.
    let domains: [AtlasDomain]

    /// How many files the inference placed in nothing. Printed rather than hidden: it is the
    /// number that says how much of the picture the guess declined to make.
    let unassigned: Int

    let wheel: ArgoPalette.DomainWheel
    let materials: ArgoPalette.MaterialRoles

    public init(
        domains: [AtlasDomain],
        unassigned: Int,
        wheel: ArgoPalette.DomainWheel,
        materials: ArgoPalette.MaterialRoles,
    ) {
        self.domains = domains
        self.unassigned = unassigned
        self.wheel = wheel
        self.materials = materials
    }

    public var body: some View {
        AtlasSidebarSection("Legend") {
            Text("Colour · Domain · inferred")
                .argoLine(ArgoTypography.machineCaption, .sectionHeader)
                .textCase(.uppercase)
            swatches
            HStack(spacing: ArgoSpacing.base) {
                AtlasLegendEnd(value: named, share: largest, aligned: .leading)
                Spacer(minLength: ArgoSpacing.base)
                AtlasLegendEnd(value: loose, share: "no domain", aligned: .trailing)
            }
            reading
        }
    }

    /// The blocks: the largest regions, then the grey, in one strip the width of the rail.
    ///
    /// Hard-edged and equal, like `AtlasLegendKey`'s own pass and for the same reason — the strip
    /// IS the claim the map makes, and a domain shades into nothing.
    private var swatches: some View {
        HStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(shown.enumerated()), id: \.offset) { _, domain in
                // The Domain's OWN rank, never its place in this strip: the strip shows the three
                // largest, and a colour counted here would be the wrong one for any Domain the
                // reader's filter had emptied ahead of it (#1158).
                Rectangle().fill(wheel.hue(domain.rank, confidence: domain.confidence))
            }
            if unassigned > 0 {
                Rectangle().fill(materials.unassigned)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: AtlasKeyMeasure.passHeight)
        // A pill, which is how the approved render draws the measured key beside it.
        .clipShape(.capsule)
    }

    /// What the colour is worth, and the tier it is worth it AT. The last sentence is the one that
    /// has to survive being skimmed, so it is the only emphasised thing in the column.
    private var reading: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text(lead)
                .argoLine(ArgoTypography.caption, .metadata)
            // The one line in this column that has to survive being skimmed, so it is the only
            // emphasised thing in it — the weight the design gives it, and the whole of what the
            // third honesty tier means for a reader who reads one sentence of a legend.
            Text("Domains are inferred from names and change history. Nobody confirmed them.")
                .argoLine(ArgoTypography.captionEmphasis, .title)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// What the colour is, with the two words the sentence is ABOUT carrying the design's own
    /// weight: a reader who takes in nothing else has to come away with which channel means what.
    ///
    /// Concatenated runs rather than markdown: a `Text` reads markdown out of a literal only, so
    /// an interpolated string reaches the screen with its asterisks in it — and an
    /// `AttributedString` whose emphasis is an intent loses it under the `.font` this column sets
    /// on the whole line. A weight set on the run itself is the one spelling that survives both.
    private var lead: AttributedString {
        var text = AttributedString("Each file's ")
        text += Self.loud("colour")
        text += AttributedString(" is its ")
        text += Self.loud("domain")
        text += AttributedString(
            " — \(domains.count) of them, each tiled as one region. "
                + "Washed-out means unsure; grey belongs to none.",
        )
        return text
    }

    /// One word of the sentence at the weight the design gives it.
    ///
    /// The face is set on the RUN, which is the one spelling that survives: markdown is read out
    /// of a `Text` literal only, so an interpolated sentence arrives with its asterisks in it, and
    /// an emphasis carried as an intent is flattened by the `.font` this column sets on the whole
    /// line. It is the contract's own emphasis role at this rung, never a weight chosen here.
    private static func loud(_ word: String) -> AttributedString {
        var run = AttributedString(word)
        run.font = ArgoTypography.captionEmphasis.font
        return run
    }

    /// The regions the strip has room to tell apart. Past a handful the blocks are narrower than
    /// the eye can read a hue off, and the map names every region anyway — the colour is an aid to
    /// a name, never the identifier (`DomainWheel`).
    private var shown: [AtlasDomain] {
        Array(domains.prefix(Self.shownCount))
    }

    private var named: String {
        "\(domains.count) named"
    }

    private var loose: String {
        "\(unassigned) unassigned"
    }

    /// What the strip stands for, counted rather than typed: a repository with two Domains must
    /// not be told it is looking at the three largest.
    ///
    /// Spelled as a word, which is the design's own "the three largest": this is prose about the
    /// picture rather than a figure read off it, and every number this key does report — the two
    /// counts at the ends — is set in the machine face beside it.
    private var largest: String {
        shown.count == domains.count
            ? (domains.count == 1 ? "the only one" : "all \(domains.count)")
            : "the three largest"
    }

    /// How many regions the strip stands for. Three, spelled once here and in `largest` above as
    /// the word the caption uses.
    private static let shownCount = 3
}

/// Nine subjects at nine confidences, which is what the committed measurement infers — enough that
/// the strip has neighbours on the wheel to stay clear of, and one region we are barely sure of.
private let previewDomains: [AtlasDomain] = [
    ("evidence", 0.86, 14), ("media", 0.71, 11), ("entities", 0.64, 11),
    ("session", 0.52, 10), ("fixtures", 0.48, 9), ("slash", 0.44, 9),
    ("syntax", 0.33, 6), ("atlas", 0.22, 4), ("plus", 0.12, 3),
].enumerated().map { rank, domain in
    AtlasDomain(
        name: domain.0,
        tokens: [domain.0],
        members: (0 ..< domain.2).map {
            AtlasDomainMember(path: "argo/\(domain.0)/\($0).swift", confidence: domain.1)
        },
        rank: rank,
    )
}

private struct AtlasDomainKeyPreview: View {
    @Environment(\.argo) private var argo

    var domains = previewDomains
    var unassigned = 12

    var body: some View {
        AtlasDomainKey(
            domains: domains,
            unassigned: unassigned,
            wheel: argo.color.atlas.domain,
            materials: argo.color.atlas.materials,
        )
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Atlas domain key — nine subjects, twelve files in none") {
    AtlasDomainKeyPreview().argoAppearance()
}

// A repository the inference barely partitioned: two regions and most of it in neither. The claim
// to look at is that the strip says so — the caption counts what it drew rather than promising
// three, and the grey is most of the picture.
#Preview("Atlas domain key — two subjects, and most of it in none") {
    AtlasDomainKeyPreview(domains: Array(previewDomains.prefix(2)), unassigned: 61)
        .argoAppearance()
}

// Everything placed: no grey at all, so the strip carries no block for it. A grey standing for
// nothing would be the key claiming a region the map is not drawing.
#Preview("Atlas domain key — everything placed") {
    AtlasDomainKeyPreview(unassigned: 0).argoAppearance()
}
