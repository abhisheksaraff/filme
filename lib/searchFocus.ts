// lib/searchFocus.ts
// Lets a tap on Home's search pill open the keyboard on the Search page. iPhone Safari only raises the keyboard
// for a field focused during the tap itself, and the real field does not exist until the next page has loaded.
// So the tap focuses a hidden field kept in the page frame, and Search hands focus to its own field once it opens;
// focus moving between fields keeps the keyboard up.

let proxy: HTMLInputElement | null = null;
let requested = false;

export const searchFocus = {
  /** The hidden field in the frame registers itself here. */
  attach(el: HTMLInputElement | null) {
    proxy = el;
  },
  /** Call inside the tap on the way to Search. */
  prime() {
    requested = true;
    proxy?.focus({ preventScroll: true });
  },
  /** Whether Search should focus its field now; reading it clears the request. */
  take(): boolean {
    const was = requested;
    requested = false;
    return was;
  },
};
