// The ONE place `@shadcn/react` is imported (#1766, ADR-0033). The package is pinned at exactly
// 0.3.1 and owns scroll behaviour and the tail/anchor mechanics; it does no virtualisation and
// holds no height. Argo owns every height, so a swap to a virtualizer or a fork of the package
// stays inside this module and the Feed does not notice.
export { MessageScroller } from '@shadcn/react/message-scroller'
