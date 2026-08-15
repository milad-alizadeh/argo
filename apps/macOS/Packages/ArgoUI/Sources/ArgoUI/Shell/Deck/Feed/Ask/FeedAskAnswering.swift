import ArgoEngine
import SwiftUI

/// How a feed row answers the question it is drawing.
///
/// The environment and not a parameter, because the rows are hosted per table cell: a closure
/// threaded down would cross four views that have nothing to do with a question, and the table
/// already replays the whole environment into every cell (`FeedTableModel`).
///
/// It takes the ask's id as well as the answer, so the reply names the question that was ON SCREEN
/// rather than whatever the gate is holding by the time the click lands.
///
/// A row with nowhere to send an answer draws no affordance at all, so the default is never reached
/// from one — it is what a preview and a specimen get.
extension EnvironmentValues {
    @Entry var feedAskAnswering: @MainActor (String, AskAnswer) -> Void = { _, _ in }
}
