import type { ComponentPropsWithoutRef } from 'react'
import { AppPageHeader } from '../../app/components/app-shell'

export function WorkspaceContentChrome(props: ComponentPropsWithoutRef<'header'>) {
  return <AppPageHeader data-component="WorkspaceContentChrome" {...props} />
}
