import SwiftUI

/// Which zones the deck has at a given width, and how wide each one opens. `ArgoLayout` keeps the
/// tokens; this makes the decisions from them.
///
/// Built per layout pass from the width `GeometryReader` reports, so nothing here is state.
struct DeckZoning {
    /// What the row has to divide up.
    let deck: CGFloat
    let feed: [FeedRow]
    /// Which row's evidence the reader opened, if any. Resolved against the feed below rather than
    /// trusted: a live transcript grows under an open panel.
    let open: FeedRow.ID?
    /// Where the reader dragged the two movable seams.
    let seams: DeckSeams

    /// Who else is working, read off the same rows the reader is looking at.
    var agents: [FeedAgent] {
        FeedAgents.all(in: feed)
    }

    /// On screen only while subagents are running, and never beside the panel.
    var showsRail: Bool {
        !isPanelOpen && agents.contains(where: \.isRunning)
    }

    /// A `Bool` rather than the evidence itself: the evidence is re-read out of a live feed every
    /// time the transcript grows, and an animation keyed to it would re-run the whole re-flow.
    var isPanelOpen: Bool {
        openEvidence != nil
    }

    /// The open row's evidence, resolved against the CURRENT feed rather than remembered. An id no
    /// row answers to closes the panel rather than holding it open on nothing.
    var openEvidence: FeedEvidence? {
        guard let open else { return nil }
        return feed.first(where: { $0.id == open })?.content.opened
    }

    /// How far the rail may be dragged at THIS width. Read against the lane at its narrowest,
    /// because the lane is a share of what the rail leaves and so gives way with the feed.
    var railLimits: ClosedRange<CGFloat> {
        ArgoLayout.railLimits(in: deck)
    }

    /// The lane's share of what it and the feed have between them. The rail is outside that span,
    /// so dragging the rail narrows the lane with the reading rather than only the reading.
    var laneWidth: CGFloat {
        let rail = showsRail ? seams.rail.wrappedValue + ArgoLayout.seamGrabWidth : 0
        return ArgoLayout.minimapLaneWidth(sharing: deck - rail)
    }

    var panelLimits: ClosedRange<CGFloat> {
        ArgoLayout.evidencePanelLimits(in: deck)
    }

    /// The panel's width, defaulting to its share of the WHOLE deck — the rail and the minimap are
    /// both shut while it is open. Seated on a whole point, the opening width included
    /// (`ArgoLayout.seated`).
    var panelWidth: Binding<CGFloat> {
        let limits = panelLimits
        let opening = deck * ArgoLayout.evidencePanelShare
        let seam = seams.panel
        return Binding(
            get: { ArgoLayout.seated(seam.wrappedValue ?? opening, in: limits) },
            set: { seam.wrappedValue = $0 },
        )
    }
}
