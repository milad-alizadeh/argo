import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import type { FeedImageSource } from './image-lightbox'
import type { useImageLightboxTransition } from './image-lightbox-transition'

// S14 permits this black media scrim in both appearances; ADR-0038 still governs pane surfaces.
const MEDIA_DIALOG_SCRIM_COLOR = 'rgb(0 0 0 / 60%)'
const MEDIA_DIALOG_SLOTS = {
  backdrop: 'fixed inset-0 z-50',
  popup: 'fixed inset-0 z-50 grid h-dvh w-dvw place-items-center bg-transparent p-6 outline-none',
  scrim: 'absolute inset-0 border-0 p-0 will-change-[opacity]',
  controls: 'absolute top-4 right-4 z-20 flex items-center gap-2',
  preview:
    'relative z-10 h-auto w-auto max-h-[calc(100dvh-var(--inset-lightbox-margin-y))] max-w-[calc(100dvw-var(--inset-lightbox-margin-x))] rounded-lg object-contain',
}

export function MediaDialog({
  image,
  transition,
}: {
  image: FeedImageSource
  transition: ReturnType<typeof useImageLightboxTransition>
}) {
  const { t } = useTranslation('sessions')
  return (
    <DialogPortal>
      <DialogPrimitive.Backdrop
        data-slot="media-dialog-backdrop"
        className={MEDIA_DIALOG_SLOTS.backdrop}
      />
      <DialogPrimitive.Popup data-slot="media-dialog" className={MEDIA_DIALOG_SLOTS.popup}>
        <DialogTitle className="sr-only">{image.title}</DialogTitle>
        <DialogDescription className="sr-only">{t('image.preview')}</DialogDescription>
        <button
          ref={transition.backdropRef}
          type="button"
          tabIndex={-1}
          aria-label={t('image.closeBackdrop')}
          className={MEDIA_DIALOG_SLOTS.scrim}
          style={{ backgroundColor: MEDIA_DIALOG_SCRIM_COLOR }}
          onClick={transition.close}
        />
        <div ref={transition.controlsRef} className={MEDIA_DIALOG_SLOTS.controls}>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t('image.download', { title: image.title })}
            nativeButton={false}
            render={<a href={image.source} download={image.title} />}
          >
            <Icon name="download" />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t('image.close')}
            onClick={transition.close}
          >
            <Icon name="close" />
          </Button>
        </div>
        <img
          ref={transition.previewRef}
          src={image.source}
          width={image.previewSize?.width}
          height={image.previewSize?.height}
          alt={image.alt}
          className={MEDIA_DIALOG_SLOTS.preview}
        />
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}
