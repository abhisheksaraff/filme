// lib/viewerChrome.ts
// Hides the app's own back button and bottom bar while a full-screen viewer is open, so a tap on the viewer's close
// button can never land on the button underneath it.

let open = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let shield: HTMLElement | null = null;

/** Call when a viewer opens; call the returned function when it closes. Safe to nest and to reopen at once. */
export function hideAppChrome(): () => void {
  clearTimeout(timer);
  shield?.remove();
  shield = null;
  open++;
  document.documentElement.dataset.viewer = "open";

  return () => {
    open--;
    if (open > 0) return;
    // A tap can still arrive just after the viewer closes; a clear sheet absorbs it before the page underneath returns.
    shield = document.createElement("div");
    shield.setAttribute("aria-hidden", "true");
    shield.style.cssText = "position:fixed;inset:0;z-index:60;background:transparent";
    document.body.appendChild(shield);
    timer = setTimeout(() => {
      if (open > 0) return;
      delete document.documentElement.dataset.viewer;
      shield?.remove();
      shield = null;
    }, 400);
  };
}
