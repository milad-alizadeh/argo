@testable import ArgoUI
import Foundation
import Testing

/// Every claim is anchored on the SANS width of the same characters — a hard-coded point value
/// would only re-state whatever font the machine happens to install.
@MainActor
@Suite("Prose metrics faces")
struct ProseMetricsFaceTests {
    static let plain = "answered finished looked"
    static let backticked = "`answered` `finished` `looked`"

    @Test
    func `a backticked string measures wider than the same characters unbacked`() {
        #expect(ProseMetrics.width(of: Self.backticked) > ProseMetrics.width(of: Self.plain))
    }

    @Test
    func `the floor under a backticked word is the mono's, not the sans'`() {
        #expect(ProseMetrics.word(in: "`answered`") > ProseMetrics.word(in: "answered"))
    }

    /// The floor is the widest word MEASURED. Twelve narrow sans characters have the higher count
    /// and the smaller width, so picking by count deals the column too little room for the word
    /// that actually cannot be broken.
    @Test
    func `the floor is the widest word, not the one with the most characters`() {
        let mixed = "iiiiiiiiiiii `wwwwww`"

        #expect(ProseMetrics.width(of: "`wwwwww`") > ProseMetrics.width(of: "iiiiiiiiiiii"))
        #expect(ProseMetrics.word(in: mixed) == ProseMetrics.width(of: "`wwwwww`"))
    }

    /// The bug itself. At a measure the sans fits on one line, the mono does not — and `lay(out:)`
    /// has to report the wrap the drawn `Text` takes, not the one a single font would have taken.
    @Test
    func `code spans wrap at the width they are drawn at`() {
        let measure = ProseMetrics.width(of: Self.plain) + 1

        #expect(ProseMetrics.lay(out: Self.plain, across: measure).lines == 1)
        #expect(ProseMetrics.lay(out: Self.backticked, across: measure).lines > 1)
    }

    /// The consequence a reader sees: the row's band is as tall as the cell draws, so nothing is
    /// placed on top of it.
    @Test
    func `a table row with a code dense cell is placed at the height it draws at`() {
        let inside = ProseMetrics.width(of: Self.plain) + 1
        let column = inside + ArgoFeedRow.tableCellInsetX * 2
        let table = MarkdownTable(header: ["check"], rows: [[Self.backticked]])
        let oneLine = ProseFace.body.height(ofLines: 1) + ArgoFeedRow.tableCellInsetY * 2

        #expect(table.heights(on: [column])[1] > oneLine)
    }

    /// Why the cell reached the wrap boundary at all: the column is dealt width from `asks`, and a
    /// code-dense column has to ask for the mono's room. Asking in the sans is what pushed the cell
    /// onto the line the row was not tall enough for.
    @Test
    func `a code dense column asks for more room than the same characters unbacked`() {
        let backtickedAsk = MarkdownTable(header: ["check"], rows: [[Self.backticked]]).asks[0]
        let plainAsk = MarkdownTable(header: ["check"], rows: [[Self.plain]]).asks[0]

        #expect(backtickedAsk.ideal > plainAsk.ideal)
        #expect(backtickedAsk.floor > plainAsk.floor)
    }

    /// #766's remaining triage question.
    ///
    /// This pins the invariant at the setting the run is at; it cannot MOVE Dynamic Type in
    /// process, so it would not by itself have caught the mono being built at `rung.size`, which
    /// equals the platform's resolved size at the default setting.
    @Test(arguments: ArgoTypeScale.allCases)
    func `the mono is the same point size as the sans at every rung`(rung: ArgoTypeScale) {
        let sans = ProseFace(rung: rung)
        let mono = sans.monospaced

        #expect(mono.font.pointSize == sans.font.pointSize)
        #expect(mono.font.isFixedPitch)
    }
}
