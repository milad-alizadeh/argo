// Allow side-effect CSS imports (e.g. globals.css) inside Storybook config files,
// which are type-checked under the node tsconfig (no vite/client types there).
declare module '*.css'
