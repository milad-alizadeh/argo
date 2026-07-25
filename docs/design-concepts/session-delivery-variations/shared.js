const selectTab = (tab) => {
  const tabList = tab.closest('[role="tablist"]');
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];

  for (const candidate of tabs) {
    const selected = candidate === tab;
    const panel = document.getElementById(candidate.getAttribute('aria-controls'));
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  }
};

for (const tabList of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;

      switch (event.key) {
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      selectTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  }
}

const setDemoState = (state) => {
  document.body.dataset.demoState = state;

  for (const control of document.querySelectorAll('[data-demo]')) {
    if (control.hasAttribute('aria-pressed')) {
      control.setAttribute('aria-pressed', String(control.dataset.demo === state));
    }
  }

  const announcement = document.querySelector('[data-demo-announcement]');
  if (announcement) {
    announcement.textContent =
      state === 'empty' ? 'Empty session state shown' : 'Active session state shown';
  }
};

for (const control of document.querySelectorAll('[data-demo]')) {
  control.addEventListener('click', () => setDemoState(control.dataset.demo));
}

for (const disclosure of document.querySelectorAll('[data-disclosure]')) {
  disclosure.addEventListener('click', () => {
    const target = document.getElementById(disclosure.getAttribute('aria-controls'));
    const expanded = disclosure.getAttribute('aria-expanded') === 'true';
    disclosure.setAttribute('aria-expanded', String(!expanded));
    target.hidden = expanded;
    if (disclosure.dataset.label) {
      disclosure.textContent = `${expanded ? 'Show' : 'Hide'} ${disclosure.dataset.label}`;
    }
  });
}
