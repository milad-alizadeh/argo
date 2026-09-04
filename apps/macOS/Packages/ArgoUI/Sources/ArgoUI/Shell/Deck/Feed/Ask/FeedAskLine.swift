import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// A question put to somebody, drawn where it was asked — and, while Argo is holding it open, the
/// thing you press. The one attention-coloured thing in the feed, and only while it is WAITING; an
/// answered one goes neutral. Neither state moves.
///
/// **The answer is given here, in the row where the question was asked.** There is no vessel: the
/// composer talks to the Session, it does not answer it. One `AskUserQuestion` is one card with one
/// ground however many questions it put, because two grounds would put a seam through a single
/// stop.
package struct FeedAskLine: View {
    @Environment(\.argo) private var argo
    @Environment(\.feedAskAnswering) private var answering

    let ask: FeedAsk

    /// What the row is holding before it is sent. Held per row rather than per question, because
    /// the whole call goes as one answer.
    @State private var held = FeedAskHeld()

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
            ForEach(Array(ask.questions.enumerated()), id: \.offset) { index, question in
                FeedAskQuestion(question: question, ink: ink, under: under(question, at: index))
            }
            if ask.isReported {
                reported
            }
        }
        .padding(inset)
        .background(ground, in: RoundedRectangle(cornerRadius: ArgoRadius.control))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(spoken)
    }

    /// Where a question Argo does not own came from, and where an answer to it can go (#1205).
    ///
    /// A row drawn off the companion plugin arrives at CONVENTION, and degrade-down forbids it
    /// being indistinguishable from one Argo owns — so it says so, on the same marker grid the
    /// question above it is set on, at the quieter rung every piece of meta in the feed takes.
    ///
    /// It also has to say where the answer goes, because this is the one waiting ask row with
    /// nothing to press: Argo answered the call the moment it arrived, so the composer is the only
    /// route left to the agent.
    private var reported: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            ArgoGlyph(ArgoSymbol.mcpTool, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .feedMarkerColumn()
            Text(Self.reportedWords)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The caption itself, `package` so the row's own measurement lays out the words it will draw
    /// rather than a second copy of them.
    nonisolated package static let reportedWords =
        "asked over the companion plugin · answer in the composer"

    /// What a screen reader is told the card is. The reported row is named apart from the two
    /// beside it: "waiting on you" over a card with nothing to press would send somebody looking
    /// for a control that is not there.
    private var spoken: String {
        if ask.isReported {
            return "Question asked over the companion plugin, answer in the composer"
        }
        return ask.isPending ? "Question, waiting on you" : "Question, answered"
    }

    /// What stands under one question, per `FeedAsk.reading` — the fork the row's arithmetic
    /// height and the overview lane take too, so none of the three can drift from the others.
    private func under(_ question: Ask.Question, at index: Int) -> FeedAskQuestion.Under {
        switch ask.reading {
        case .waiting:
            .waiting(offers: ask.offers(in: question), held: FeedAskQuestion.Waiting(
                held: Binding(get: { held[index] }, set: { held[index] = $0 }),
                needsClosing: held.needsClosing(question, at: index),
                hasSomethingToSend: held.hasSomethingToSend(at: index),
                pick: { pick($0, in: question, at: index) },
                send: { close(at: index) },
            ))
        case .pending:
            .offer(ask.offers(in: question))
        case .settled:
            .answer(ask.answered(question))
        }
    }

    /// Taking an option. On a many-of question it ticks a box and nothing else happens; on a one-of
    /// question the click IS the answer, so it replaces whatever was held and settles the question.
    ///
    /// It also SHUTS `Other` again. Opening the field is a way of not picking one of these; going
    /// back and picking one has to be the whole act it was before, or the same gesture answers the
    /// question one moment and does nothing the next.
    private func pick(_ ordinal: Int, in question: Ask.Question, at index: Int) {
        guard question.allowsMultiple else {
            held[index].ordinals = [ordinal]
            held[index].isOtherOpen = false
            return sendIfSettled()
        }
        if held[index].ordinals.contains(ordinal) {
            held[index].ordinals.remove(ordinal)
        } else {
            held[index].ordinals.insert(ordinal)
        }
    }

    private func close(at index: Int) {
        held[index].isClosed = true
        sendIfSettled()
    }

    /// The answer goes when EVERY question has been settled: one call is one thing the agent is
    /// waiting on, so a reply carrying half of it would answer a question nobody finished.
    private func sendIfSettled() {
        guard let live = ask.live, held.isSettled(ask.ask) else { return }
        answering(live.askID, held.answer(for: ask.ask))
    }

    /// The attention role while it waits, and the marker rung once it is not.
    ///
    /// The quiet half is `text.tertiary` and NOT `FeedAsk.ink`'s `.message`: the glyph sits in the
    /// marker column, and once the row is a reading it is one of the markers — the numbers beside
    /// it are tertiary, and a mark one rung brighter than the column it stands in reads as still
    /// asking for something. `FeedAsk.ink` stays the LANE's reading, where a rung is a loudness
    /// rather than a role.
    private var ink: ArgoColor {
        ask.ink == .attention ? ask.ink.role(in: argo.color) : argo.color.text.tertiary
    }

    /// A wash rather than a fill: the row still has to read as part of the column it interrupts.
    ///
    /// The row is carried by its ground ALONE — no rule around it and no leading accent bar. An
    /// amber stroke on four edges reads as an alert banner dropped into the column rather than as a
    /// row of it. Answered, the ground goes and nothing moves.
    private var ground: ArgoColor {
        ask.ink == .attention ? ArgoOperationalState.attention.ground(in: argo.color) : .transparent
    }

    /// The card's padding is what holds its words off its ground. With no ground there is nothing
    /// to hold them off, and 12 on four sides is an indent under a card nobody can see — a settled
    /// question then hangs right of the rows above it instead of reading as one of them (#1207).
    private var inset: CGFloat {
        ask.hasGround ? ArgoFeedRow.askCardInset : 0
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(ask: FeedAsk) {
        self.ask = ask
    }
}

/// One question and what stands under it — the offer, pressable or read, or the way it went.
private struct FeedAskQuestion: View {
    /// What one question draws under it, one case per `FeedAsk.Reading` and each carrying what
    /// only that case can use (#1207).
    enum Under {
        /// Argo is holding the question open: the pressable cards, the field, `Answer`.
        case waiting(offers: [FeedAskOffer], held: Waiting)
        /// The options as they were offered, numbered — the reading #534 built. Empty where the
        /// question offered none, since free-form asks exist.
        case offer([FeedAskOffer])
        /// The way the record settled it. Absent where nothing readable came back.
        case answer(FeedAskAnswer.Words?)
    }

    /// What this question offers while Argo holds it open.
    struct Waiting {
        let held: Binding<FeedAskHeld.Marks>
        let needsClosing: Bool
        let hasSomethingToSend: Bool
        let pick: (Int) -> Void
        let send: () -> Void
    }

    @Environment(\.argo) private var argo

    let question: Ask.Question
    let ink: ArgoColor
    let under: Under

    /// The ask glyph takes the same marker column the option numbers do, so the block is one grid
    /// and the read options need no indent of their own.
    var body: some View {
        VStack(alignment: .leading, spacing: step) {
            HStack(alignment: .firstTextBaseline, spacing: gap) {
                ArgoGlyph(ArgoSymbol.asked, .inline)
                    .foregroundStyle(ink)
                    .feedAskMarkColumn(isSettled: isSettled)
                Text(question.text)
                    .argoText(ArgoFeedRow.proseRung)
                    .foregroundStyle(argo.color.text.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            options
        }
    }

    /// A settled question has no numbered options left under it, so its glyph takes the column
    /// every other verb in the feed does and the row reads as one of them. The other two readings
    /// keep the marker column, because their options ARE numbered into it (#1207).
    private var isSettled: Bool {
        if case .answer = under {
            return true
        }
        return false
    }

    private var gap: CGFloat {
        isSettled ? ArgoFeedRow.callGap : ArgoFeedRow.markerGap
    }

    /// Pressable cards need the room a bare list does not; the two readings take the step the
    /// offer already used.
    private var step: CGFloat {
        if case .waiting = under {
            return ArgoSpacing.comfortable
        }
        return ArgoFeedRow.stepBeforeProse
    }

    @ViewBuilder private var options: some View {
        switch under {
        case let .waiting(offers, waiting):
            FeedAskOfferList(
                question: question,
                offers: offers,
                held: waiting.held,
                needsClosing: waiting.needsClosing,
                hasSomethingToSend: waiting.hasSomethingToSend,
                pick: waiting.pick,
                send: waiting.send,
            )
        case let .offer(offers):
            if !offers.isEmpty {
                FeedAskOptions(offers: offers)
            }
        case let .answer(answer):
            if let answer {
                FeedAskAnswer(answer: answer)
            }
        }
    }
}
