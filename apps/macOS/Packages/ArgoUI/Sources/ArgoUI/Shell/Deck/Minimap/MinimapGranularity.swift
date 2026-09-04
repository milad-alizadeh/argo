import Foundation

/// How much of the reading one mark of the overview lane stands for (#1173).
///
/// The lane is ~800pt tall and two marks need `rectMinimumHeight + rectGap` between them to read as
/// two, so it holds about four hundred distinguishable marks whatever the session is worth in
/// points. Past that length the lane is not calculating anything wrongly — it has run out of lane,
/// and the only thing left to give is what a mark MEANS.
///
/// So the lane coarsens rather than compresses: a session that will not fit a mark a row is drawn a
/// mark a Turn, which over nine real transcripts takes eight of them to the whole session at once
/// and the longest — the 238 MB record #650 was reported on — from 8% of itself to 74%.
enum MinimapGranularity: Equatable, Sendable {
    /// A mark a row, and the row's own reported shape — what every session the lane fits is
    /// drawn at.
    case rows
    /// A mark a Turn. The rows are still what the mark is MEASURED from — a Turn's mark starts at
    /// its first row's `y` and stands as tall as its rows together — so nothing about where the
    /// lane maps a place in the reading changes with it.
    case turns
}

extension MinimapGeometry {
    /// Which of the two the reading is drawn at.
    ///
    /// No literal threshold, and none is needed: `grain > fitScale` is already exactly the sentence
    /// "this session does not fit at this granularity", derived from the document rather than from
    /// a row count somebody chose (ADR-0028 Rule 4). Try rows; if they do not fit, draw Turns —
    /// and where the Turns do not fit either, draw Turns and window, the way the lane windows
    /// rows today.
    ///
    /// A reading with no Turn extents to measure keeps rows whatever it costs, because coarsening
    /// to nothing is not coarsening.
    var granularity: MinimapGranularity {
        guard !turns.isEmpty, shortTurnHeight > 0 else { return .rows }
        guard !reading.rows.isEmpty, scrollableHeight > 0, lane.height > 0 else { return .rows }
        guard !isCoarsened else { return .turns }
        return rowGrain <= fitScale ? .rows : .turns
    }

    /// The compression below which the lane stops drawing the reading's structure at all, at
    /// whichever granularity it is drawing.
    var grain: CGFloat {
        switch granularity {
        case .rows: rowGrain
        case .turns: turnGrain
        }
    }

    /// The compression at which three rows in four are still drawn as their own mark: a rect at the
    /// floor, and the gap that keeps it off the row above it. Exactly the distance
    /// `MinimapGeometry.isCrowded` needs between two stacked rects to draw both — past this the
    /// lane starts dropping every other row's mark and the map stops mimicking the reading's
    /// structure, which is the whole of what #658 found and what the lane is for.
    ///
    /// A quarter of the rows may fall under it, and that is the bound rather than an accident:
    /// `shortRowHeight` is the lower quartile, so the rows it starves are at most a quarter of the
    /// reading by construction — 20 of 459 on a real session, where the mean allowed 329. Not the
    /// SHORTEST row either: a session's rules and its one-line Turns are a point or two each, and
    /// holding the whole map to those would keep a long session at a compression where nothing
    /// fits.
    var rowGrain: CGFloat {
        guard shortRowHeight > 0 else { return columnScale }
        return (ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap) / shortRowHeight
    }

    /// The same sentence about Turns, read off the same quartile. A Turn is worth its rows
    /// together, so this is smaller than `rowGrain` by however many rows a Turn holds — which over
    /// the nine measured transcripts is between six and fifty.
    var turnGrain: CGFloat {
        guard shortTurnHeight > 0 else { return columnScale }
        return (ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap) / shortTurnHeight
    }
}
