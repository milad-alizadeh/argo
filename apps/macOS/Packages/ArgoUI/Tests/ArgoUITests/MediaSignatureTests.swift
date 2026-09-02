import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which byte runs the cockpit will offer a click on, decided from the head of the run and nothing
/// else (ADR-0028 Rule 3). Getting it wrong is silent both ways: a picture filed as not one loses
/// the click, and a run filed as a picture opens a lightbox on a frame that cannot be drawn.
///
/// The files are ImageIO's own rather than heads assembled here, so a signature is checked against
/// the format and not against a copy of the array it is matched by.
@Suite("Telling a picture from a byte run")
struct MediaSignatureTests {
    @Test
    func `every format the decoder reads is offered as a picture`() throws {
        let written: [(format: String, bytes: Data)] = try [
            ("PNG", MediaFixture.png(width: 48, height: 32)),
            ("GIF", MediaFixture.gif(width: 48, height: 32)),
            ("JPEG", MediaFixture.jpeg(width: 48, height: 32)),
            ("BMP", MediaFixture.bmp(width: 48, height: 32)),
            ("TIFF", MediaFixture.tiff(width: 48, height: 32)),
        ]

        // Named rather than counted, so a row that stops matching says which format it was.
        let missed = written
            .filter { !MediaDecode.isPicture(.held($0.bytes.base64EncodedString())) }

        #expect(missed.map(\.format) == [])
    }

    /// Why the WebP row is two runs and not one. A sound file opens `RIFF` exactly as a picture
    /// does, and a table matching that alone would offer a click onto every WAV a call ever came
    /// back with.
    @Test
    func `a RIFF that is a sound file is not offered as a picture`() {
        let wave = Data([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]
            + Array("WAVEfmt ".utf8) + Array(repeating: 0, count: 16))

        #expect(MediaDecode.isPicture(.held(wave.base64EncodedString())) == false)
    }
}
