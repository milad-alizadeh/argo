import { readCssSize } from '../../lib/read-css-size'

export function readShellPanelSizes() {
  return {
    sidebarDefault: readCssSize('--size-shell-sidebar-default'),
    sidebarMinimum: readCssSize('--size-shell-sidebar-min'),
    sidebarMaximum: readCssSize('--size-shell-sidebar-max'),
    contentMinimum: readCssSize('--size-shell-content-min'),
  }
}
