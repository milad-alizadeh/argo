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
    /// The reading's own frame changing — its SHAPE, which the clip view's frame cannot say. A
    /// closure and not a second frame observer, so the pair of decisions the deck makes about a
    /// frame is reached from one registration (#971).
    var reshaped: (() -> Void)?
    /// Whether the reading is where the keyboard is, in the sense the row cursor is drawn on: the
    /// keyboard is here AND the keyboard is what the reader is working with (#533).
    var keyboardMoved: ((Bool) -> Void)?
    /// The focused row's own words, or `nil` when there are none to take. Read twice — to answer
    /// ⌘C,
    /// and to grey Edit ▸ Copy out over a reading with nothing selectable in it.
    var focusedWords: (() -> String?)?

    /// How many times the reading has been laid out. One layout pass realises and sizes every
    /// cell on screen, so this is the one honest count of what a mount or a landing COST — see
    /// `FeedMountCostTests`. Not DEBUG-only: it is one increment on a path that already lays out
    /// a screenful of SwiftUI.
    private(set) var layouts = 0

    override func layout() {
        layouts += 1
        super.layout()
    }

    /// How the reader is working. The app's one reader by default; a suite hands the table its own
    /// rather than share a mutable global between cases.
    var reader = ArgoFocusVisibility.shared

    /// Arriving is not the same as arriving BY keyboard. A click that lands in the reading makes
    /// this the first responder just as a Tab does, so which it was comes off the last event the
    /// app saw — the same question every hand-drawn ring in the cockpit asks.
    override func becomeFirstResponder() -> Bool {
        let arrived = super.becomeFirstResponder()
        if arrived {
            keyboardMoved?(reader.isOn)
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

    /// A click inside a reading the keyboard was ALREADY in — the one path no responder change
    /// reports, and the one that left the ring standing under the pointer.
    override func mouseDown(with event: NSEvent) {
        super.mouseDown(with: event)
        keyboardMoved?(false)
    }

    override func keyDown(with event: NSEvent) {
        // A key in the reading is the reader working it by keyboard, whether or not it moves the
        // cursor — the counterpart of `mouseDown` below.
        keyboardMoved?(true)
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

    /// Edit ▸ Copy, arriving at the reading: the focused row's words, as the agent wrote them
    /// (#767).
    ///
    /// The responder action rather than a key in `keyDown`, because the menu item claims ⌘C before
    /// the event reaches a view. Reaching for it is keyboard work, so the cursor comes back onto
    /// the
    /// row being taken — a copy off a row with no cursor drawn would be a paste from nowhere.
    @objc func copy(_: Any?) {
        guard let words = focusedWords?() else { return }
        keyboardMoved?(true)
        ArgoPasteboard.put(words)
    }

    override func viewDidEndLiveResize() {
        super.viewDidEndLiveResize()
        liveResizeEnded?()
    }

    /// Every route AppKit resizes this view by ends here, which is what makes it the seam the
    /// document's own frame notification used to be. Reported unconditionally, for the reason that
    /// notification was: a size that did not move is the routine case, and the decision about it
    /// belongs to whoever is mapping the reading.
    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        reshaped?()
    }

    private func isActivation(_ event: NSEvent) -> Bool {
        event.specialKey == .carriageReturn
            || event.specialKey == .enter
            || event.charactersIgnoringModifiers == " "
    }
}

extension FeedTableView {
    /// Greys Edit ▸ Copy out over a reading with nothing to take. Every other item is left to the
    /// table's own answer.
    override func validateUserInterfaceItem(_ item: NSValidatedUserInterfaceItem) -> Bool {
        guard item.action == #selector(copy(_:)) else {
            return super.validateUserInterfaceItem(item)
        }
        return focusedWords?() != nil
    }
}
