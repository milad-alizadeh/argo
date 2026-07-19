import { addons } from 'storybook/manager-api'
import { themes } from 'storybook/theming'

// The Cockpit is dark-first; default the Storybook UI chrome to match its stories.
addons.setConfig({ theme: themes.dark })
