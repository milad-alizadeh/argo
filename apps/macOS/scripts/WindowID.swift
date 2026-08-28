#!/usr/bin/env swift
// Prints the CoreGraphics window id of the frontmost on-screen window belonging to the process
// whose pid is argv[1]. `screencapture -l <id>` needs that number and has no way to look it up.
//
// By pid, not owner name: more than one Argo can be up, and a name match would return whichever
// the window list put first — a screenshot of the wrong tree, and it looks entirely plausible.
//
// Run as a script (`swift WindowID.swift 4213`) rather than built into a target: it is a
// screenshot utility, and nothing that ships in the app should be able to enumerate windows.

import CoreGraphics
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("window-id: \(message)\n".utf8))
    exit(1)
}

guard CommandLine.arguments.count > 1, let pid = Int(CommandLine.arguments[1]) else {
    fail("usage: WindowID.swift <pid>")
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    fail("cannot read the window list")
}

/// The list is front-to-back, so the first match is the window a screenshot should catch.
/// Layer 0 filters out panels, menus and the shadow layers a window carries.
let match = windows.first { window in
    window[kCGWindowOwnerPID as String] as? Int == pid
        && window[kCGWindowLayer as String] as? Int == 0
}

guard let number = match?[kCGWindowNumber as String] as? Int else {
    fail("no on-screen window owned by pid \(pid)")
}

print(number)
