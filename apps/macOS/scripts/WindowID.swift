#!/usr/bin/env swift
// Prints the CoreGraphics window id of the frontmost on-screen window belonging to the app
// named in argv[1]. `screencapture -l <id>` needs that number and has no way to look it up.
//
// Run as a script (`swift WindowID.swift Argo`) rather than built into a target: it is a
// screenshot utility, and nothing that ships in the app should be able to enumerate windows.

import CoreGraphics
import Foundation

let appName = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Argo"

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    FileHandle.standardError.write(Data("window-id: cannot read the window list\n".utf8))
    exit(1)
}

/// The list is front-to-back, so the first match is the window a screenshot should catch.
/// Layer 0 filters out panels, menus and the shadow layers a window carries.
let match = windows.first { window in
    window[kCGWindowOwnerName as String] as? String == appName
        && window[kCGWindowLayer as String] as? Int == 0
}

guard let number = match?[kCGWindowNumber as String] as? Int else {
    FileHandle.standardError
        .write(Data("window-id: no on-screen window owned by \(appName)\n".utf8))
    exit(1)
}

print(number)
