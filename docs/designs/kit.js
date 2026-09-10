const renderTargets = {
  desktopShell: () => {
    const panel = document.querySelector('[data-component="DesignPanel"]')
    if (!panel) return

    const status = document.createElement('p')
    status.setAttribute('data-component', 'KitStatus')
    status.textContent = 'Current state: ready'
    panel.appendChild(status)
  },
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    renderTargets.desktopShell()
  })
}
