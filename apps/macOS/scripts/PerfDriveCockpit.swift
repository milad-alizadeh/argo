// The Accessibility half of `perf-drive` — how a running Argo is found, read, and named.
// See perf-drive.swift for what drives it.

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

struct Node {
    var role: String
    var label: String
    var rect: CGRect
    var depth: Int

    var centre: CGPoint {
        CGPoint(x: rect.midX, y: rect.midY)
    }
}

enum Access {
    static func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else {
            return nil
        }
        return value
    }

    /// AX answers geometry as an opaque `AXValue` and the C API has no typed accessor. The type id
    /// is checked first, so the downcast below is the one that check just proved.
    static func value(_ element: AXUIElement, _ name: String) -> AXValue? {
        guard let held = attribute(element, name), CFGetTypeID(held) == AXValueGetTypeID() else {
            return nil
        }
        return unsafeDowncast(held, to: AXValue.self)
    }

    static func frame(of element: AXUIElement) -> CGRect? {
        guard let position = value(element, kAXPositionAttribute),
              let size = value(element, kAXSizeAttribute)
        else {
            return nil
        }
        var origin = CGPoint.zero
        var extent = CGSize.zero
        guard AXValueGetValue(position, .cgPoint, &origin),
              AXValueGetValue(size, .cgSize, &extent)
        else {
            return nil
        }
        return CGRect(origin: origin, size: extent)
    }

    /// Depth-first, bounded: a deep SwiftUI hierarchy must not hang the driver.
    static func walk(_ element: AXUIElement, depth: Int = 0, limit: Int = 28) -> [Node] {
        guard depth < limit else { return [] }
        let role = (attribute(element, kAXRoleAttribute) as? String) ?? "?"
        let label = [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute]
            .compactMap { attribute(element, $0) as? String }
            .first { !$0.isEmpty } ?? ""
        var found = [Node(
            role: role,
            label: label,
            rect: frame(of: element) ?? .zero,
            depth: depth,
        )]
        for child in (attribute(element, kAXChildrenAttribute) as? [AXUIElement]) ?? [] {
            found += walk(child, depth: depth + 1, limit: limit)
        }
        return found
    }
}

/// The running Argo's main window: what to read, and where to aim.
struct Cockpit {
    static let bundleID = "dev.milad.argo"

    let window: AXUIElement
    let rect: CGRect

    /// Raises the app first. A scroll event goes to whatever window is UNDER the pointer, not to
    /// the window whose coordinates placed it — so a target behind the launching terminal gets
    /// nothing and the terminal gets the scroll, which looks exactly like a measurement.
    static func resolve() -> Cockpit? {
        guard let app = NSRunningApplication
            .runningApplications(withBundleIdentifier: bundleID).first
        else {
            return nil
        }
        app.activate(options: [])
        Thread.sleep(forTimeInterval: 0.8)
        let element = AXUIElementCreateApplication(app.processIdentifier)
        // AX is served on the app's main thread and the default timeout is under a second, so a
        // request made while a large transcript is being read fails with `cannotComplete` — which
        // arrives here as an empty tree, indistinguishable from an app with no roster at all.
        AXUIElementSetMessagingTimeout(element, 30)
        guard let windows = Access.attribute(element, kAXWindowsAttribute) as? [AXUIElement],
              let window = windows.first, let rect = Access.frame(of: window)
        else {
            return nil
        }
        return Cockpit(window: window, rect: rect)
    }

    var nodes: [Node] {
        Access.walk(window)
    }

    /// The roster's rows, by their real titles.
    ///
    /// A row is deliberately ONE accessibility element (`RosterE2ECase`), and its announcement —
    /// title, state, age — is carried by the `AXUnknown` inside its cell rather than by the
    /// unlabelled `AXRow`. So a row is named by that child, and clicked at its centre.
    ///
    /// Rows only PARTLY inside the outline are dropped: the list scrolls under its own top edge,
    /// and a click at a clipped row's centre lands on whatever is drawn over it. Rows below the
    /// fold are not here at all — the outline realises what it shows and nothing else.
    var rosterRows: [Node] {
        let live = nodes
        guard let outline = live.first(where: { $0.role == "AXOutline" }) else { return [] }
        return live.filter { node in
            node.role == "AXUnknown" && !node.label.isEmpty && outline.rect.contains(node.rect)
        }
    }

    /// One entry per element the deck is showing ON SCREEN, as role and geometry.
    ///
    /// Visible only, and that is the whole trick. A long reading's rows above the viewport sit at a
    /// mixture of measured and estimated heights, and each AX query answers differently — the
    /// shape of what nobody can see never holds still, so a signature including it never settles.
    var deckShape: [String] {
        Access.walk(window, limit: 14)
            .filter { $0.rect.midX > rect.minX + rect.width * 0.25 }
            .filter { $0.rect.intersects(rect) }
            .map { "\($0.role)@\(Int($0.rect.minX)),\(Int($0.rect.minY)),\(Int($0.rect.height))" }
    }

    /// What the cockpit is showing, as one string.
    ///
    /// Frame cadence cannot answer "has the switch finished": the readings are assembled off the
    /// main thread, so a switch that takes seconds to put content up drops no frames while it
    /// does. This asks the surface instead. Geometry and roles, never labels, and never the
    /// roster — a row's "7m ago" and a subagent's running duration restate themselves on a clock
    /// rather than on the switch, and a signature holding them never holds still at all.
    var signature: String {
        let title = (Access.attribute(window, kAXTitleAttribute) as? String) ?? ""
        let shape = deckShape
        return "\(title)#\(shape.count)#\(shape.joined(separator: "|").hashValue)"
    }

    /// A point inside the reading, past the roster and clear of the chrome bar.
    var feedPoint: CGPoint {
        CGPoint(x: rect.minX + rect.width * 0.7, y: rect.minY + rect.height * 0.6)
    }

    /// The rooms control is AppKit's `NSSegmentedControl`, whose segments AX exposes as buttons.
    func roomSegment(named room: String) -> Node? {
        nodes.first {
            $0.role == "AXRadioButton"
                && $0.label.localizedCaseInsensitiveCompare(room) == .orderedSame
        }
    }
}
