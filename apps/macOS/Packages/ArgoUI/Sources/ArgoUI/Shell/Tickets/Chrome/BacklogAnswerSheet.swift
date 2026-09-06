import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The sheet a backlog answer draws on (#1317) — the question at its head, the prose or the wait
/// in its body, and the one act that ends either at its foot.
///
/// **Over the ticket pane, never the list.** The list holds the tickets the reader asked about,
/// and taking it costs them the thing they were looking for. Not a popover either: three sentences
/// fill one at 360 and an answer is regularly longer. The ticket pane already holds prose, and it
/// is the pane a reader searching the backlog has stopped reading.
///
/// **Over that pane's CONTENT and not its band.** #1242 put the ticket's verbs on the band, so a
/// sheet drawn over the whole pane would take `Start` away in order to show a ticket you cannot
/// start. The band stands and the answer sits under it — which is why this is applied as an
/// overlay on the detail rather than on the pane.
///
/// **The cost is real:** the open ticket's body goes behind this, so comparing the two means
/// closing one. That is the trade the design accepts.
///
/// Raw prose, and nothing more. The citations that make a number pressable are #1319's, the
/// attribution that names who answered is #1318's, and the failures are #1320's. This is the
/// tracer bullet: it is done when somebody can ask the backlog a question and read the answer.
struct BacklogAnswerSheet: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// What was asked, held verbatim — the sheet heads itself with the reader's own words, and the
    /// same string through the wait and the answer so the head never switches under them.
    let question: String
    /// How many tickets the answer read, or is reading. Stated on the surface rather than behind a
    /// disclosure: an answer whose sources are hidden is one nobody can check.
    let reads: Int
    /// The prose, and `nil` while a model is still reading — which is what puts the wait in the
    /// body and `Stop` at the foot in place of `Close`.
    let prose: String?
    /// Whether the prose is an ANSWER rather than a refusal's sentence. It gates the read line
    /// alone: stating what an answer read, over a read that never happened, is a false DIRECT
    /// (`docs/domain/honesty-tier.md`, degrade-down). #1320 gives a refusal a surface of its own;
    /// until then the least it must not do is claim provenance.
    var wasRead = false
    /// Abandon the question in flight. Reached only while `prose` is `nil`.
    var stop: () -> Void = {}
    /// Dismiss an answer that arrived, leaving the room exactly as it was — the query still in the
    /// field, the list still narrowed by it, the ticket still open behind this.
    var close: () -> Void = {}
    /// Put the SAME question again. Drawn beside `Close` in the design's answered foot, and it
    /// earns its place for a reason the wait makes plain: an answer takes four to eleven seconds
    /// (#1315), so re-asking by retyping is the one act a reader would otherwise pay that twice
    /// for.
    var again: () -> Void = {}

    @State private var risen = false

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            head
            sheetBody
            foot
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // OPAQUE, at the pane's own ground. The sheet stands IN FOR the pane's content rather than
        // floating over it, and a translucent one would leave the ticket's own prose legible
        // underneath — two answers to one question, in one column.
        .background(argo.color.surface.base.color)
        .offset(y: risen ? 0 : ArgoSpacing.base)
        .opacity(risen ? 1 : 0)
        .animation(ArgoMotion.stateChange.resolved(reduceMotion: reduceMotion), value: risen)
        .onAppear { risen = true }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Answer to “\(question)”")
        .accessibilityAddTraits(.isModal)
    }

    private var head: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.comfortable) {
            ArgoGlyph(ArgoSymbol.askBacklog, .inline)
                .foregroundStyle(argo.color.interaction.accentBright)
            Text(question)
                .argoLine(ArgoTypography.bodyHeading, .title)
            Spacer(minLength: ArgoSpacing.base)
            // A plain dismiss, deliberately not `CloseControl` — that one CLOSES A TICKET on its
            // provider, and one glyph cannot mean both "put this sheet away" and "mark this
            // resolved" in a room where the ticket it would close is open behind the sheet.
            ArgoIconButton(
                ArgoSymbol.dismiss,
                voice: ArgoControlVoice("Close", help: "Close this answer"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: close,
            )
        }
        .padding(.horizontal, ArgoSpacing.region)
        .padding(.top, ArgoSpacing.section)
    }

    /// The sheet has a head, a body and a foot; `body` itself is the `View` requirement, so the
    /// middle one carries the sheet's name to stay one of the three.
    private var sheetBody: some View {
        Group {
            if let prose {
                ScrollView {
                    Text(prose)
                        .argoLine(ArgoTypography.body, .body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                BacklogAskWait(reads: reads)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, ArgoSpacing.region)
        .padding(.top, ArgoSpacing.loose)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// What the answer read, and the one act. The read line is here in BOTH states because it is
    /// the honest mitigation for the failure that cannot be drawn: a model that misses a ticket
    /// that does exist leaves nothing on screen to see, and a reader who knows it saw all twelve
    /// knows a miss is a miss rather than a gap in what was fetched.
    private var foot: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            // While a model is READING, and after it has answered — but never over a refusal,
            // which read nothing and must not be captioned as though it had.
            if prose == nil || wasRead {
                Text(read)
                    .argoLine(ArgoTypography.rowMeta, .metadata)
            }
            if prose == nil {
                Button("Stop", action: stop)
                    .buttonStyle(.quiet)
            } else {
                // One act carries a ground and the other does not. `Ask again` spends a model
                // again; `Close` puts a sheet away. Drawn at the same weight they read as a pair
                // of equal choices, which is the hierarchy the design's foot exists to state.
                HStack(spacing: ArgoSpacing.section) {
                    Button("Ask again", action: again)
                    Button("Close", action: close)
                        .buttonStyle(.plain)
                        .argoLine(ArgoTypography.control, .metadata)
                        .keyboardShortcut(.cancelAction)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, ArgoSpacing.region)
        .padding(.top, ArgoSpacing.loose)
        .padding(.bottom, ArgoSpacing.section)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(argo.color.edge.hairline.color)
                .frame(height: ArgoStroke.border)
        }
    }

    /// What the answer may read, stated and never behind a disclosure. Exactly what the room has
    /// already fetched — more than the plain field, which sees the number and the title; less than
    /// a Session, which can read a body. **Bodies are out on purpose:** an answer that depended on
    /// which bodies happened to be cached would change between two readers of the same view, and
    /// repeatable is the property that lets anybody check it.
    private var read: String {
        """
        Read \(reads) tickets — number, title, labels, priority, type, status word and the \
        blockedBy edges the room already holds. No ticket body, no comments, nothing you clicked.
        """
    }
}

#Preview("Backlog answer sheet — answered") {
    BacklogAnswerSheet(
        question: "is there a ticket for the chart's spacing?",
        reads: 12,
        prose: """
        The chart's spacing is #336, The canvas: derived spacing and the edge rule — low \
        priority, Todo, and the only open ticket that names spacing at all. It never uses the \
        word “chart”, which is why the field found nothing.
        """,
    )
    .frame(width: 520, height: 420)
    .argoAppearance()
}

#Preview("Backlog answer sheet — asking") {
    BacklogAnswerSheet(
        question: "is there a ticket for the chart's spacing?",
        reads: 12,
        prose: nil,
    )
    .frame(width: 520, height: 420)
    .argoAppearance()
}
