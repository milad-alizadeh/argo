import AppKit
@testable import ArgoUI

/// Whether a claim that needs a REAL window can be made here.
///
/// A few of AppKit's behaviours only happen against a window server: a mounted window laying its
/// subtree out, and the frame notifications that layout posts (#955). On GitHub's runners the test
/// process gets none of that — a window mount lays out nothing, so a claim that a layout re-fired
/// its own notification asserts the runner rather than the code, and fails.
///
/// The precedent is `LiveCLI.isEnabled` in `ArgoEngine`: what a machine cannot do is a skip with a
/// stated reason, never a claim quietly weakened until it passes everywhere.
enum WindowedTests {
    static let areAvailable = ProcessInfo.processInfo.environment["CI"] == nil
        && !NSScreen.screens.isEmpty
}
