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
                FeedAskQuestion(
                    question: question,
                    offers: ask.offers(in: question),
                    ink: ink,
                    reading: reading(question, at: index),
                )
            }
            if ask.isReported {
                reported
            }
        }
        .padding(ArgoFeedRow.askCardInset)
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

    /// Which of the three readings this question is (#1207).
    ///
    /// **The branch between the last two is `isAnswered`, not `waiting == nil`.** Three rows are
    /// pending and not pressable, and every one of them would be wrecked by folding: a question on
    /// a Session Argo cannot drive (#546), one whose gate has not raised it yet, and one reported
    /// over the companion plugin — which `FeedProjection+Ask.reported` builds `isAnswered: false`,
    /// so it is never a settled row whatever its caption says. None of the three has an answer, so
    /// a fold there would draw a decision nobody made.
    private func reading(_ question: Ask.Question, at index: Int) -> FeedAskQuestion.Reading {
        guard ask.isWaiting else {
            return ask.isAnswered ? .settled(ask.answered(question)) : .pending
        }
        return .waiting(FeedAskQuestion.Waiting(
            held: Binding(get: { held[index] }, set: { held[index] = $0 }),
            needsClosing: held.needsClosing(question, at: index),
            hasSomethingToSend: held.hasSomethingToSend(at: index),
            pick: { pick($0, in: question, at: index) },
            send: { close(at: index) },
        ))
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(ask: FeedAsk) {
        self.ask = ask
    }
}

// Every shape a call can put a question in, while Argo holds it open. The settled reading is the
// preview above; these are the states where the row is the thing you press.

/// One question and what stands under it — the offer, pressable or read, or the way it went.
private struct FeedAskQuestion: View {
    /// The three readings a question can be in (#1207). #534 and #712 branched on one question —
    /// *is this row the thing you press?* — and gave everything that was not the same drawing: the
    /// question, then every option it offered, one line each. That put two different facts in one
    /// shape, and the fold applies to exactly one of them.
    enum Reading {
        /// Argo is holding the question open: the pressable cards, the field, `Answer`.
        case waiting(Waiting)
        /// Nobody has answered it and nothing here can — the numbered offer, as #534 built it.
        case pending
        /// The record has settled it: the question, and the way it went. The offer folds out, and
        /// the words are absent where nothing readable came back.
        case settled(FeedAskAnswer.Words?)
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
    /// The options it offered, numbered, in the order it offered them.
    let offers: [FeedAskOffer]
    let ink: ArgoColor
    let reading: Reading

    /// The ask glyph takes the same marker column the option numbers do, so the block is one grid
    /// and the read options need no indent of their own.
    var body: some View {
        VStack(alignment: .leading, spacing: step) {
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
                ArgoGlyph(ArgoSymbol.asked, .inline)
                    .foregroundStyle(ink)
                    .feedMarkerColumn()
                Text(question.text)
                    .argoText(ArgoFeedRow.proseRung)
                    .foregroundStyle(argo.color.text.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            options
        }
    }

    /// Pressable cards need the room a bare list does not. Both readings take the step the offer
    /// used to, so the fold moves nothing that was already on the grid.
    private var step: CGFloat {
        if case .waiting = reading {
            return ArgoSpacing.comfortable
        }
        return ArgoFeedRow.stepBeforeProse
    }

    /// What stands under the question, per reading.
    ///
    /// A **settled** question draws the way it went and never its offer, whatever it offered. A
    /// **pending** one draws the options exactly as they were offered, in the order they were
    /// offered, and a question that offered none draws nothing — free-form asks exist. While it
    /// **waits** it draws its field either way, which is the whole of what it offers.
    @ViewBuilder private var options: some View {
        switch reading {
        case let .waiting(waiting):
            FeedAskOfferList(
                question: question,
                offers: offers,
                held: waiting.held,
                needsClosing: waiting.needsClosing,
                hasSomethingToSend: waiting.hasSomethingToSend,
                pick: waiting.pick,
                send: waiting.send,
            )
        case .pending:
            if !offers.isEmpty {
                FeedAskOptions(offers: offers)
            }
        case let .settled(answer):
            if let answer {
                FeedAskAnswer(answer: answer)
            }
        }
    }
}
