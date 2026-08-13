import AppKit
import SwiftUI

/// The feed's table — `NSTableView` plus the keyboard verbs the reading answers to. Closures
/// rather than a delegate: the coordinator is already both of the delegates a table has.
final class FeedTableView: NSTableView {
    /// One row up or down. Consumes the arrows whether or not a row is focused yet — the move
    /// itself scrolls the landing row into view, so the keys still move the reading.
    var stepFocus: ((Int) -> Void)?
    /// Return and Space, both — what a focused control answers to on this platform. Answers
    /// whether the row took it; a key an inert row refused falls through to the table's own
    /// handling.
    var activateFocused: (() -> Bool)?
    /// A key the table's own handling scrolled by — Space paging, Home, End. Reported so the
    /// follow latch reads the landing; a paged scroll is the reader's as much as a wheel's.
    var keyScrolled: (() -> Void)?
    /// The window's live resize ending — the moment the deferred full re-measure runs.
    var liveResizeEnded: (() -> Void)?
    /// The keyboard arriving at the reading or leaving it. Reported because the row cursor is
    /// drawn only while it is here: a ring on a row while the composer holds the keys is a cursor
    /// pointing at the surface the reader is NOT working (#533).
    var keyboardMoved: ((Bool) -> Void)?

    override func becomeFirstResponder() -> Bool {
        let arrived = super.becomeFirstResponder()
        if arrived {
            keyboardMoved?(true)
        }
        return arrived
    }

    override func resignFirstResponder() -> Bool {
        let left = super.resignFirstResponder()
        if left {
            keyboardMoved?(false)
        }
        return left
    }

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
