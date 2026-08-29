import Foundation

/// Where each edge meets the box at either of its ends.
///
/// Every edge used to leave by the MIDDLE of a face. That is right for a flowchart, where a node
/// rarely carries more than a link or two a side, and wrong the moment two edges share one face: a
/// class diagram's composition and aggregation then draw their filled and hollow diamonds at one
/// point, the filled one wins, and the diagram says a thing its author did not write (#920).
///
/// So a face carrying several ends FANS them along itself. A face carrying one keeps the midpoint
/// to the point, which is what makes this behaviour-neutral for the common case.
struct MermaidExits {
    /// One per `graph.edges`, in that order. `nil` where an end names a node never placed.
    let ends: [Pair?]
    /// The edges routed round the outside rather than across the rank gap — the ones the ranking
    /// had to turn around, and every self-loop. They leave and re-enter by the FLANK, so they fan
    /// along a different axis and are shared out apart from the rest.
    let around: Set<Int>

    struct Pair: Equatable, Sendable {
        let tail: CGPoint
        let head: CGPoint
    }
}

extension MermaidExits {
    static func of(
        _ graph: MermaidGraph,
        placement: MermaidPlacement,
        reversed: Set<Int>,
    )
        -> Self {
        let around = Set(graph.edges.indices.filter {
            reversed.contains($0) || graph.edges[$0].from == graph.edges[$0].to
        })
        let fan = MermaidFan(
            placement: placement,
            filled: Set(graph.nodes.filter(\.fillsBox).map(\.name)),
        )
        var faces: [MermaidFace: [MermaidEnd]] = [:]
        for (at, edge) in graph.edges.enumerated() {
            guard let from = placement.boxes[edge.from], let to = placement.boxes[edge.to] else {
                continue
            }
            let kinds: (MermaidFace.Kind, MermaidFace.Kind) = around.contains(at)
                ? (.flank, .flank)
                : (.exit, .entry)
            let places = kinds.0 == .flank
                ? (Self.place(of: at, in: around), Self.place(of: at, in: around))
                : (fan.far(of: to, on: kinds.0), fan.far(of: from, on: kinds.1))
            faces[MermaidFace(name: edge.from, kind: kinds.0), default: []]
                .append(MermaidEnd(edge: at, isHead: false, far: places.0))
            faces[MermaidFace(name: edge.to, kind: kinds.1), default: []]
                .append(MermaidEnd(edge: at, isHead: true, far: places.1))
        }
        return MermaidExits(
            ends: fan.dealt(faces, over: graph.edges.count, in: placement.boxes),
            around: around,
        )
    }

    /// Which lane a back edge runs in, counted out from the ranks — one step further out than the
    /// back edge before it. ONE definition, read both by the fan that places its ends and by the
    /// routing that draws its lane: the two are the same fact, and a flank ordered on anything
    /// else lets the outer lane cut across the inner one on its way in.
    ///
    /// Negative, so the OUTERMOST lane takes the slot at the leading end of the face. Its
    /// horizontal run is the longest, so it has to turn in past every vertical inside it — and it
    /// crosses none of them only if it arrives beyond where they all begin.
    static func place(of index: Int, in around: Set<Int>) -> CGFloat {
        -CGFloat(around.count { $0 < index } + 1)
    }

    /// How far out of the ranks one back edge is drawn.
    func lane(of index: Int) -> CGFloat {
        MermaidMeasure.backLane * Self.place(of: index, in: around)
    }
}

/// One face of one box, as the thing ends are shared out along.
///
/// The kind is part of the identity and not only the name: the face an edge leaves by and the face
/// it arrives at are opposite sides of the same box, and a key of the name alone would crowd a
/// through-node's two faces onto one fan.
private struct MermaidFace: Hashable {
    let name: String
    let kind: Kind

    enum Kind {
        case exit, entry, flank
    }
}

/// One end waiting for a place on its face.
private struct MermaidEnd {
    let edge: Int
    let isHead: Bool
    /// Where the box at the OTHER end of this edge stands on the axis its face fans along. The
    /// rank order of the far ends, which is what decides the order here: taken in it, the fanned
    /// lines cross no more than the one midpoint they all left did.
    let far: CGFloat
}

/// The arithmetic of sharing a face out: which axis it runs along, how far apart the ends stand on
/// it, and what that leaves each of them at.
private struct MermaidFan {
    let placement: MermaidPlacement
    /// The boxes whose own figure fills them, and so the only ones an end may be moved off the
    /// middle of. See `MermaidGraph.Node.fillsBox`.
    let filled: Set<String>

    /// Where a box's middle stands on the axis a face of this kind fans along.
    func far(of box: CGRect, on kind: MermaidFace.Kind) -> CGFloat {
        let middle = CGPoint(x: box.midX, y: box.midY)
        let grain = placement.grain
        return Self.isAlong(kind) ? grain.along(of: middle) : grain.across(of: middle)
    }

    /// Every end placed, back in the graph's own edge order.
    func dealt(
        _ faces: [MermaidFace: [MermaidEnd]],
        over count: Int,
        in boxes: [String: CGRect],
    )
        -> [MermaidExits.Pair?] {
        var tails = [CGPoint?](repeating: nil, count: count)
        var heads = tails
        for (face, ends) in faces {
            guard let box = boxes[face.name] else { continue }
            let room = filled.contains(face.name) ? span(of: box, on: face.kind) : 0
            for (at, end) in Self.ordered(ends).enumerated() {
                let offset = Self.offset(at: at, of: ends.count, over: room)
                let point = point(on: face, of: box, offset: offset)
                if end.isHead {
                    heads[end.edge] = point
                } else {
                    tails[end.edge] = point
                }
            }
        }
        return zip(tails, heads).map { tail, head in
            guard let tail, let head else { return nil }
            return MermaidExits.Pair(tail: tail, head: head)
        }
    }

    /// A flank runs ALONG the ranks; the faces that look up and down them run across.
    private static func isAlong(_ kind: MermaidFace.Kind) -> Bool {
        kind == .flank
    }

    /// How long the face is, which is what a crowded fan has to fit inside. A face nothing may be
    /// moved along is NO room, and every end on it falls back on the midpoint.
    private func span(of box: CGRect, on kind: MermaidFace.Kind) -> CGFloat {
        let grain = placement.grain
        return Self.isAlong(kind) ? grain.along(of: box.size) : grain.across(of: box.size)
    }

    /// The ends of one face in the order they stand on it. The far end's own place decides it —
    /// where it stands across its rank for a face that looks up or down the ranks, and which lane
    /// it runs in for a flank, which is the only place a back edge has. Two ends reaching the same
    /// place — a self-loop's pair above all — fall back on the source's own order, so the same
    /// diagram fans the same way every run.
    private static func ordered(_ ends: [MermaidEnd]) -> [MermaidEnd] {
        ends.sorted { left, right in
            guard left.far == right.far else { return left.far < right.far }
            guard left.edge == right.edge else { return left.edge < right.edge }
            return !left.isHead
        }
    }

    /// One end's own point: the middle of its face, moved along that face by its share of the fan.
    private func point(on face: MermaidFace, of box: CGRect, offset: CGFloat) -> CGPoint {
        let grain = placement.grain
        let isAlong = Self.isAlong(face.kind)
        // A face an edge LEAVES by looks the way the ranks grow, and one it enters by looks back.
        let leaves = (face.kind == .exit) != grain.isReversed
        let middle = face.kind == .flank
            ? grain.flank(of: box)
            : grain.face(of: box, ahead: leaves)
        return grain.point(
            along: grain.along(of: middle) + (isAlong ? offset : 0),
            across: grain.across(of: middle) + (isAlong ? 0 : offset),
        )
    }

    /// How far off the middle one end stands. The ends spread symmetrically about the midpoint at
    /// the step two terminal marks need to read as two. ONE end takes no offset at all, which is
    /// the whole of what the common case pays.
    ///
    /// What a crowded face gives up is the STEP and never the face: the mark at either end of the
    /// fan has to stand on the box, so what the gaps have to share is the span less one whole
    /// mark. A face that cannot hold its marks even so — more of them than `footWidth` fits along
    /// it — crowds them rather than drawing one off the edge of the box it belongs to, because a
    /// mark standing beside its box says it belongs to a box that is not there.
    private static func offset(at: Int, of count: Int, over span: CGFloat) -> CGFloat {
        guard count > 1 else { return 0 }
        let room = max(0, span - MermaidMeasure.footWidth) / CGFloat(count - 1)
        return (CGFloat(at) - CGFloat(count - 1) / 2) * min(MermaidMeasure.exitFan, room)
    }
}
