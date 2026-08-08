import SwiftUI

/// What the deck currently has open, in one value.
///
/// The two are carried together because a row takes them together: every kind of row can open
/// something, and threading them as two separate bindings put a fourth parameter on the row view
/// for no gain — a row does not care that one of them resizes a column and the other covers it.
struct FeedRowSelection {
    @Binding var open: FeedRow.ID?
    @Binding var lit: FeedShot?
}
