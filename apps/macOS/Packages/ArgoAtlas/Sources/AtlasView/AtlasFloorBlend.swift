import Metal

/// How one pass of the floor is composited onto what is already there (#1600).
enum AtlasFloorBlend {
    /// The graded ground. It IS the ground, so it writes rather than blends.
    case opaque
    /// Light laid over the ground, PREMULTIPLIED: the weight is already spent on the pigment in
    /// `atlas_floor_fragment`, so it may not be spent on it a second time here.
    case over

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
        }
    }
}
