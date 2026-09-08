import Metal

/// How one pass of the floor is composited onto what is already there (#1600).
///
/// Named rather than spelled at each pipeline, because the choice between them is the whole
/// argument: a wash may be blended, and the grain may only be MULTIPLIED.
enum AtlasFloorBlend {
    /// The graded ground. It IS the ground, so it writes rather than blends.
    case opaque
    /// Light laid over the ground, PREMULTIPLIED: the weight is already spent on the pigment in
    /// `atlas_floor_fragment`, so it may not be spent on it a second time here.
    case over
    /// The grain: the finished picture times one scalar. A multiply is the only composite of the
    /// two the design could have meant that cannot turn a hue — `atlas_grain_fragment` carries the
    /// arithmetic and the 0.0037 it costs against the design's own `overlay`.
    case multiply

    /// What the pipeline's colour attachment has to say for this to happen.
    func apply(to attachment: MTLRenderPipelineColorAttachmentDescriptor) {
        switch self {
        case .opaque:
            attachment.isBlendingEnabled = false
        case .over:
            attachment.isBlendingEnabled = true
            attachment.sourceRGBBlendFactor = .one
            attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
            attachment.sourceAlphaBlendFactor = .one
            attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
        case .multiply:
            attachment.isBlendingEnabled = true
            attachment.sourceRGBBlendFactor = .destinationColor
            attachment.destinationRGBBlendFactor = .zero
            // The picture stays opaque: the grain is spent on the colour and never on the alpha.
            attachment.sourceAlphaBlendFactor = .zero
            attachment.destinationAlphaBlendFactor = .one
        }
    }
}

/// One of the floor's passes, as the two functions it is made of and how it lands.
struct AtlasFloorPass {
    let vertex: String
    let fragment: String
    let blend: AtlasFloorBlend
}

/// What every pass of the map is compiled against: the drawable's own format and the sample count
/// the DEVICE agreed to. Taken from the renderer rather than named a second time here — a pipeline
/// that disagreed with the pass would not draw at all (#1400).
struct AtlasFloorTarget {
    let pixelFormat: MTLPixelFormat
    let samples: Int
}
