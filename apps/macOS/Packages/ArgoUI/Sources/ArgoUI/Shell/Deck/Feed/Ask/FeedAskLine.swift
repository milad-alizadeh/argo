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
                    waiting: waiting(question, at: index),
                )
            }
        }
        .padding(ArgoFeedRow.askCardInset)
        .background(ground, in: RoundedRectangle(cornerRadius: ArgoRadius.control))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(ask.isPending ? "Question, waiting on you" : "Question, answered")
    }

    /// What one question offers while it waits, and nothing at all where the row is a reading —
    /// which is every settled question, and every question on a Session Argo cannot drive (#546).
    private func waiting(_ question: Ask.Question, at index: Int) -> FeedAskQuestion.Waiting? {
        guard ask.isWaiting else { return nil }
        return FeedAskQuestion.Waiting(
            held: Binding(get: { held[index] }, set: { held[index] = $0 }),
            needsClosing: held.needsClosing(question, at: index),
            hasSomethingToSend: held.hasSomethingToSend(at: index),
            pick: { pick($0, in: question, at: index) },
            send: { close(at: index) },
        )
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

/// One question and the options it offered — read, or pressable.
private struct FeedAskQuestion: View {
    /// What this question offers while Argo holds it open. Absent makes the question a reading.
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
    package let waiting: Waiting?

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

    /// Pressable cards need the room a bare list does not.
    private var step: CGFloat {
        waiting == nil ? ArgoFeedRow.stepBeforeProse : ArgoSpacing.comfortable
    }

    /// The options exactly as they were offered, in the order they were offered. A question that
    /// offered none draws none while it is a reading — free-form asks exist — but while it waits it
    /// still draws its field, which is the whole of what it offers.
    @ViewBuilder private var options: some View {
        if let waiting {
            FeedAskOfferList(
                question: question,
                offers: offers,
                held: waiting.held,
                needsClosing: waiting.needsClosing,
                hasSomethingToSend: waiting.hasSomethingToSend,
                pick: waiting.pick,
                send: waiting.send,
            )
        } else if !offers.isEmpty {
            FeedAskOptions(offers: offers)
        }
    }
}
