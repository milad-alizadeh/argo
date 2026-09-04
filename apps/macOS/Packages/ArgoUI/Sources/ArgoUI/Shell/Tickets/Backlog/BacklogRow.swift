import ArgoDesign
import SwiftUI

/// One row of the backlog: `twist · dot · id · title`, then the ticket's labels and the trailing
/// region — a blockage mark, then one caption (`cockpit-work-room.md` — the trailing region).
///
/// The two trailing marks do not contend. The mark answers whether the ticket can be STARTED
/// (#896) and the caption says what it is or how long it has sat (#819, #897), so a row that is
/// both blocked and stale draws both. Which caption wins is `Drawn.caption(asOf:)`'s, told once.
///
/// The INDENT is the row's, not the list's: `List` insets a whole section, and what moves here is
/// one row against its siblings.
package struct BacklogRow: View {
    /// How wide the pane drawing this row is. The chips are RIGID — they would take the title's
    /// last characters rather than give up their own — so under `ArgoBacklogList.labelsAppearAt`
    /// they stand down instead. Read from the room rather than measured here: a row inside a
    /// `List` is proposed a width it cannot compare against the pane's own.
    @Environment(\.backlogPaneWidth) private var paneWidth
    /// What the age stamp is measured against, and `nil` wherever nobody pinned one — which is
    /// every case but a render. Optional rather than defaulted to `.now`, because an environment
    /// default resolves ONCE: a shipping row would then measure every age against the instant the
    /// key was first read and never advance.
    @Environment(\.backlogNow) private var pinnedNow

    let drawn: TicketsRoomProjection.Drawn
    /// Whether the twist points down. Meaningless on a leaf, whose slot draws nothing.
    let isOpen: Bool
    /// Every ink this row spends, told once against the ground under it. Handed in because the
    /// GROUND is one of them and only the outline can lay that (#1071).
    let ink: BacklogRowInk
    /// `nil` on a leaf. Passed in rather than derived: who owns the fold is the outline's business,
    /// and the row only needs to know whether it has one.
    let toggle: (() -> Void)?

    private var row: TicketsRoomProjection.Row {
        drawn.row
    }

    package var body: some View {
        line
            .frame(minHeight: ArgoBacklogList.rowHeight)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(announcement)
    }

    private var line: some View {
        HStack(spacing: ArgoBacklogList.gap) {
            BacklogTwist(toggle: toggle, isOpen: isOpen)
            DeliveryDot(reading: row.delivery)
            number
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(ink.machine)
                // RIGID, so the title is the only thing the row squeezes. Without it a row
                // carrying label chips sets the number down the column, one digit per line.
                .fixedSize()
            Text(row.title)
                .argoText(ArgoTypography.body)
                .foregroundStyle(ink.title)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoBacklogList.gap)
            labels
            // Inboard of both marks below, which is what leaves an already-blocked row drawn
            // exactly where it was when the claim mark was added (#1074).
            if row.marks.isClaimed {
                ClaimMark()
            }
            // Inboard of the caption, so the caption keeps the trailing edge it has always been
            // right-aligned to and an unblocked row is drawn exactly where it was.
            if let blockage = row.marks.blockage {
                BlockageMark(blockage: blockage)
            }
            // The same slot, and they never contend: a closed ticket's blockers are not read at
            // all, and one still in the open set has no closure to draw (#1075).
            if let closure = row.marks.closure {
                ClosureMark(closure: closure)
            }
            caption
        }
        .padding(.leading, ArgoBacklogList.gutter + ArgoBacklogList.indent(atDepth: drawn.depth))
    }

    /// The Ticket's number, `#1261`. Named rather than set in the line above so a test can read
    /// the drawn row back: this is the row #1263 was reported against, where a four-digit ticket
    /// was written `#1,261` (`IssueReading.mark`).
    var number: Text {
        Text(IssueReading.mark(row.id))
    }

    /// The provider's own labels, cut by `BacklogRowLabels`, which also decides what the
    /// announcement says. A width narrow enough to drop the chips does NOT quiet the announcement:
    /// a screen reader has no column to run out of, and the cut here is about space rather than
    /// about what the ticket is.
    @ViewBuilder private var labels: some View {
        let reading = BacklogRowLabels(row.labels)
        if !reading.shown.isEmpty, paneWidth >= ArgoBacklogList.labelsAppearAt {
            HStack(spacing: ArgoBacklogList.labelGap) {
                ForEach(reading.shown) { LabelChip(label: $0, on: ink.readOn) }
                // Counted rather than listed: the row has no width for the rest, and silence about
                // them would leave a ticket whose distinguishing label is third looking like one
                // with two labels.
                if let marker = reading.marker {
                    LabelChip(counting: marker, on: ink.readOn)
                }
            }
            .lineLimit(1)
            .fixedSize()
        }
    }

    /// Which fact wins the slot is `Drawn.caption(asOf:)`'s, told once. Only the roll-up carries a
    /// hover: a number nobody can reconcile against the rows under it has to say why on the spot.
    @ViewBuilder private var caption: some View {
        if let fact = drawn.caption(asOf: pinnedNow ?? Date()) {
            if let rollUp = row.trailing {
                captionText(fact)
                    .help("\(rollUp) — the tracker's own count of closed children, including "
                        + "children the backlog does not draw.")
            } else {
                captionText(fact)
            }
        }
    }

    private func captionText(_ fact: String) -> some View {
        Text(fact)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(ink.caption)
            // Rigid for the id's reason: `2/9` is one fact, not a column of two.
            .fixedSize()
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    /// The blockage is SPOKEN where the mark is a numeral in a capsule: speech has no capsule, so
    /// a bare `2` in this sentence would be read as a second id. The claim is spoken for the same
    /// reason its mark is wordless — a lone glyph says nothing at all to a screen reader. The
    /// closure is already a word, and is spoken as it is drawn.
    private var announcement: String {
        (
            [String(row.id), row.title] + BacklogRowLabels(row.labels).spoken
                + [
                    row.marks.isClaimed ? "claimed" : nil,
                    spokenBlockage,
                    row.marks.closure.map(ClosureMark.word),
                    drawn.caption(asOf: pinnedNow ?? Date()),
                ],
        )
        .compactMap(\.self)
        .joined(separator: ", ")
    }

    private var spokenBlockage: String? {
        row.marks.blockage.map {
            $0.isStranded ? "stranded, \($0.count) blockers" : "blocked by \($0.count)"
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        drawn: TicketsRoomProjection.Drawn,
        isOpen: Bool,
        ink: BacklogRowInk,
        toggle: (() -> Void)?,
    ) {
        self.drawn = drawn
        self.isOpen = isOpen
        self.ink = ink
        self.toggle = toggle
    }
}
