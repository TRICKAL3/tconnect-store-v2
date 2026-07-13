/** Instant scroll to page top — use once per navigation/step change (avoid stacked smooth scrolls). */
export function scrollToTop(instant = true): void {
  window.scrollTo({ top: 0, left: 0, behavior: instant ? 'auto' : 'smooth' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function scrollToElement(el: HTMLElement | null, block: ScrollLogicalPosition = 'start'): void {
  if (!el) return;
  el.scrollIntoView({ behavior: 'auto', block });
}
