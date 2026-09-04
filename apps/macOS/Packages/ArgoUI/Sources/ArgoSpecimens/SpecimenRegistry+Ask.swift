import ArgoUI
import SwiftUI

/// Every state a question row can be in — the shapes Argo holds open, the ones it cannot reach,
/// and the settled reading the fold left (#1207). Apart from `SpecimenRegistry+Feed.swift` because
/// the ask is the one row with three readings of its own, and the file that held both ran past the
/// length cap the moment the fold added its states.
extension SpecimenRegistry {
    /// The question while it WAITS — one render per shape a call can put one in (#712), judged
    /// against `docs/designs/feed-ask/`. The settled reading is `feedAttention` above; these are
    /// the states where the row is the thing you press.
    static let asks: [SpecimenEntry] = [
        SpecimenEntry("feedAskOneOf") { SpecimenScene.sessions(FeedProjection.previewAskOneOf) },
        SpecimenEntry("feedAskManyOf") { SpecimenScene.sessions(FeedProjection.previewAskManyOf) },
        SpecimenEntry("feedAskFreeForm") {
            SpecimenScene.sessions(FeedProjection.previewAskFreeForm)
        },
        SpecimenEntry("feedAskTwoQuestions") {
            SpecimenScene.sessions(FeedProjection.previewAskTwoQuestions)
        },
        // A Session Argo cannot drive draws no affordance at all (#546) — the same question, read.
        SpecimenEntry("feedAskUnavailable") {
            SpecimenScene.sessions(FeedProjection.previewAskUnavailable)
        },
        // The state between the two: driveable, but the gate is not holding this question — Argo
        // restarted under a CLI that still is. No cards, and the attention ground STAYS, because
        // it is genuinely still waiting.
        SpecimenEntry("feedAskUnreached") {
            SpecimenScene.sessions(FeedProjection.previewAskUnreached)
        },
        // The other way round (#1190): the GATE holds the question and the record does not carry
        // it. The row stands beside the stream, at the foot of the work it interrupted.
        SpecimenEntry("feedAskStanding") {
            SpecimenScene.sessions(FeedProjection.previewAskStanding)
        },
        // The same shape one tier down (#1205): the agent REPORTED this question over the plugin,
        // so Argo holds nothing to answer with. Judged against the row above it — a CONVENTION row
        // that reads as one Argo owns is the false DIRECT this state exists to catch.
        SpecimenEntry("feedAskReported") {
            SpecimenScene.sessions(FeedProjection.previewAskReported)
        },
        // The fold (#1207), judged against `feedAskOneOf` above — the same question over the same
        // work, waiting and settled. The offer is gone and one row carries the way it went.
        SpecimenEntry("feedAskAnswered") {
            SpecimenScene.sessions(FeedProjection.previewAskAnswered)
        },
        // The two states the fold puts on screen for the first time: an answer that named none of
        // the options, and a free-form one that had none to name. Both drew NOTHING before it.
        SpecimenEntry("feedAskAnsweredUnnamed") {
            SpecimenScene.sessions(FeedProjection.previewAskAnsweredUnnamed)
        },
        SpecimenEntry("feedAskAnsweredFreeForm") {
            SpecimenScene.sessions(FeedProjection.previewAskAnsweredFreeForm)
        },
    ]
}
