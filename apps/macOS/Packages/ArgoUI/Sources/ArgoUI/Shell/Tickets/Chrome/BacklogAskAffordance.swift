import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The two-line offer under the field, once the field is holding a question (#1317): Search on
/// `⏎`, Ask on `⌘⏎`.
///
/// **The ask is FOUND, never switched to.** There is no second control on the band and no mode
/// toggle — this appears under a field the reader was already typing into, and `⏎` still runs the
/// search it always ran. A reader who never looks down here has lost nothing at all.
///
/// **It is the field's own footprint**, so it takes the field's width and hangs off the field's
/// trailing edge. That is what keeps it moving with the pane's seam rather than with the window:
/// #1242 put the field on the list pane's own band, and the pane is draggable.
struct BacklogAskAffordance: View {
    @Environment(\.argo) private var argo

    /// How many rows the query itself matched — the honest arithmetic the return key still gets,
    /// stated so the reader can see what they would be choosing against.
    let matches: Int
    /// How many tickets the ask would read. The room's whole listing and not the matches: that is
    /// the difference between the two lines, and it is the reason to press the other key.
    let reads: Int

    var body: some View {
        VStack(spacing: ArgoSpacing.hair) {
            offer(.search)
            offer(.ask)
        }
        .padding(ArgoSpacing.tight)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.control))
        // The rim the design draws on the panel. The floating glass carries the drop shadow and
        // the material; the shadow alone leaves the panel's own edge DARKER than its ground, so
        // it reads as a hole rather than as a surface standing over the list.
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.glassRim.color, lineWidth: ArgoStroke.hairline)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Search, or ask the backlog")
    }

    /// Which of the two lines this is — an enum and not a bag of five strings, because the two are
    /// not arbitrary combinations: the mark, the words, the key and the emphasis are all decided
    /// by which verb the line offers, and a third line would be a third verb.
    enum Offer {
        /// The default, and it stays the default. `⏎` runs the search it always ran.
        case search
        /// The one this surface exists to introduce. Not the default, and never made one.
        case ask

        var mark: String {
            switch self {
            case .search: ArgoSymbol.searchBacklog
            case .ask: ArgoSymbol.askBacklog
            }
        }

        var title: String {
            switch self {
            case .search: "Search"
            case .ask: "Ask the backlog"
            }
        }

        var key: String {
            switch self {
            case .search: "⏎"
            case .ask: "⌘⏎"
            }
        }

        /// Whether the wand is on it and the ground under it. It says which key the surface is
        /// introducing, and it is NOT which key is the default.
        var isPreferred: Bool {
            self == .ask
        }

        /// What the mark is drawn in — the quiet one at the ink its kind already names, so no
        /// rung is hand-picked here (`check:text-ink`).
        func ink(in palette: ArgoPalette) -> ArgoColor {
            palette.askMark(lit: isPreferred)
        }
    }

    /// What the ask's second line says, and `nil` for Search — which is ONE line in the design,
    /// its count set into the title beside the word rather than under it. The two are not
    /// symmetrical on purpose: Search is the default and is being named, the ask is being
    /// explained.
    private func detail(of offer: Offer) -> String? {
        switch offer {
        case .search: nil
        case .ask: "Reads all \(reads), not just the titles"
        }
    }

    /// The line's own words. Search states its arithmetic inline — `Search — 0 of 12 match` — so
    /// the two offers are one line and two rather than two and two.
    private func title(of offer: Offer) -> String {
        switch offer {
        case .search: "\(offer.title) — \(matches) of \(reads) match"
        case .ask: offer.title
        }
    }

    private func offer(_ offer: Offer) -> some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(offer.mark, .inline)
                .foregroundStyle(offer.ink(in: argo.color))
            VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                Text(title(of: offer))
                    .argoLine(ArgoTypography.body, offer.isPreferred ? .title : .body)
                if let detail = detail(of: offer) {
                    Text(detail)
                        .argoLine(ArgoTypography.rowMeta, .metadata)
                }
            }
            Spacer(minLength: ArgoSpacing.base)
            KeyCap(offer.key)
        }
        .padding(ArgoSpacing.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            offer.isPreferred ? argo.color.surface.selected.color : .clear,
            in: .rect(cornerRadius: ArgoRadius.marker),
        )
    }
}

/// One key, drawn as a key. A rim and no ground, because it names a key on the reader's keyboard
/// rather than a control on the screen — a filled cap here would be a third thing to press.
private struct KeyCap: View {
    @Environment(\.argo) private var argo

    let key: String

    init(_ key: String) {
        self.key = key
    }

    var body: some View {
        Text(key)
            .argoLine(ArgoTypography.machineCaption, .metadata)
            .padding(.horizontal, ArgoSpacing.tight)
            .padding(.vertical, ArgoSpacing.hair)
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(argo.color.edge.subtle.color, lineWidth: ArgoStroke.border)
            }
            // The key is drawn for the eye; a screen reader is told the shortcut by the line it
            // sits on, and reading `⌘⏎` as characters would be noise on top of it.
            .accessibilityHidden(true)
    }
}

#Preview("Backlog ask affordance") {
    BacklogAskAffordance(matches: 0, reads: 12)
        .frame(width: ArgoTicketsChrome.askWidth)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
