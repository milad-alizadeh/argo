import Foundation

/// What a file's own bytes say about it: how many there are, and how many lines they make.
///
/// Both come from ONE read, so a file's size and its line count can never be two different reads of
/// two different versions of it. The read is memory-mapped where the platform will: the largest
/// file in this repository is 4.8 MB and a repository can hold far worse, and nothing here needs
/// the bytes after it has counted them.
enum AtlasFileMeasures {
    /// A file that cannot be read at all — a broken symlink, a submodule's gitlink, a permission
    /// the process does not have — measures NOTHING here and is still a Plot: the history knows
    /// how often it was committed, and dropping it would take a file off the map that git says is
    /// in the repository (#1148).
    static func measured(at fileURL: URL) -> [String: Double] {
        guard let data = try? Data(contentsOf: fileURL, options: .mappedIfSafe) else { return [:] }
        var measures = ["bytes": Double(data.count)]
        // A NUL byte is what `git diff` itself calls binary, and a binary file has no lines to
        // count rather than zero of them — an absent measure, which is not the same reading.
        guard !data.contains(0) else { return measures }
        let newlines = data.count(where: { $0 == UInt8(ascii: "\n") })
        // A last line with no newline after it is still a line. `wc -l` would say otherwise, and
        // would call a one-line file with no terminator empty.
        let unterminated = data.last.map { $0 != UInt8(ascii: "\n") } ?? false
        measures["lines"] = Double(newlines + (unterminated ? 1 : 0))
        return measures
    }
}
