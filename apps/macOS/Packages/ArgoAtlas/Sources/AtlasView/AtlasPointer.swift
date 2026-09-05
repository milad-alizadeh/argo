import MetalKit

/// What turns a pointer into a file: the renderer that drew the frame, and the caller waiting to
/// be told what is under the cursor (#1153).
///
/// The coordinator rather than the renderer itself, because a pick is a fact about a POINT in a
/// view and the renderer knows only pixels. The conversion between the two is `AtlasPixel`, spent
/// here, once.
@MainActor
final class AtlasPointer: NSObject, MTKViewDelegate {
    let renderer: AtlasVolumeRenderer?
    var resolve: (String?) -> Void = { _ in }
    /// What the reader opened, said on a click (#1154). Apart from `resolve` because they are two
    /// different questions: a pointer passing over the map must not rewrite what somebody is
    /// reading, which is what a click is for.
    var picked: (String?) -> Void = { _ in }

    /// The last point the pointer was at, in the view's own points, or nothing once it has left.
    /// Kept so a frame that has just landed can re-answer the question the pointer already asked,
    /// without waiting for it to move again.
    private var point: CGPoint?
    /// What was last said, so a pointer crossing a hundred pixels of one file says its name once.
    /// Not an optimisation of the READ — that is four bytes — but of everything downstream: each
    /// answer is a SwiftUI state write, and a body per pixel of travel is a body per pixel.
    ///
    /// Two properties rather than a double optional, because there really are three readings: a
    /// file, no file, and nothing said yet. The third is what keeps the FIRST answer from being
    /// swallowed as a repeat of a `nil` nobody ever heard.
    private var hasSaid = false
    private var said: String?
    private weak var view: MTKView?

    init(renderer: AtlasVolumeRenderer?) {
        self.renderer = renderer
        super.init()
        // Every answer comes from here: a frame lands, and whatever the pointer was already asking
        // is answered against it. Nothing else re-reads, which is what leaves no path that can read
        // a target the GPU has not finished writing.
        renderer?.whenIdsSettle { [weak self] in self?.reread() }
    }

    /// The view the pointer's points are in, held weakly: AppKit owns it, and a coordinator that
    /// kept it alive would keep a Metal drawable alive with it.
    func attach(_ view: MTKView) {
        self.view = view
    }

    func moved(to point: CGPoint?) {
        self.point = point
        reread()
    }

    /// What the reader clicked (#1154). The file drawn at that pixel, or NO file, which is an
    /// answer of its own: clicking the ground closes the reading, so a click on nothing has to
    /// arrive rather than be dropped.
    ///
    /// A frame that has not landed answers nothing, and nothing is what happens — the same rule
    /// `reread` follows. There is no frame to resolve a click against, and resolving it against
    /// the frame before would open the file that used to be under the cursor.
    func clicked(at point: CGPoint) {
        guard let renderer, let view, let pixel = AtlasPixel(
            point, in: view.bounds.size, drawable: view.drawableSize,
        ), let pick = renderer.pick(atPixel: pixel)
        else { return }
        picked(pick.file)
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        renderer?.mtkView(view, drawableSizeWillChange: size)
    }

    func draw(in view: MTKView) {
        renderer?.draw(in: view)
    }

    /// The answer for wherever the pointer is now, against the frame currently drawn.
    ///
    /// A frame that has not landed says nothing at all, and nothing is what happens: the last
    /// answer stands until the frame that can replace it arrives, rather than the name blinking
    /// off and back on across a camera drag.
    private func reread() {
        let under: String?
        if let point, let renderer, let view, let pixel = AtlasPixel(
            point, in: view.bounds.size, drawable: view.drawableSize,
        ) {
            guard let pick = renderer.pick(atPixel: pixel) else { return }
            under = pick.file
        } else {
            under = nil
        }
        guard !hasSaid || said != under else { return }
        hasSaid = true
        said = under
        resolve(under)
    }
}
