import AppKit
import SwiftUI

/// The feed's table — `NSTableView` plus the keyboard verbs the reading answers to.
///
/// Closures rather than a delegate, because the coordinator is already both of the delegates a
/// table has and these are not table questions: which row the keyboard is on is a fact about the
/// READING, held where the rows are.
final class FeedTableView: NSTableView {
    /// One row up or down. Consumes the arrows whether or not a row is focused yet — the move
    /// itself scrolls the landing row into view, so the keys still move the reading.
    var stepFocus: ((Int) -> Void)?
    /// Return and Space, both — what a focused control answers to on this platform, and a reader
    /// should not have to learn which one this surface chose. Answers whether the row took it;
    /// a key an inert row refused falls through to the table's own handling.
    var activateFocused: (() -> Bool)?
    /// A key the table's own handling scrolled by — Space paging, Home, End. Reported so the
    /// follow latch reads the landing; a paged scroll is the reader's as much as a wheel's.
    var keyScrolled: (() -> Void)?
    /// The window's live resize ending — the moment the deferred full re-measure runs.
    var liveResizeEnded: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        if event.specialKey == .upArrow {
            stepFocus?(-1)
        } else if event.specialKey == .downArrow {
            stepFocus?(1)
        } else if isActivation(event) {
            if activateFocused?() != true {
                super.keyDown(with: event)
                keyScrolled?()
            }
        } else {
            super.keyDown(with: event)
            keyScrolled?()
        }
    }

    override func viewDidEndLiveResize() {
        super.viewDidEndLiveResize()
        liveResizeEnded?()
    }

    private func isActivation(_ event: NSEvent) -> Bool {
        event.specialKey == .carriageReturn
            || event.specialKey == .enter
            || event.charactersIgnoringModifiers == " "
    }
}
