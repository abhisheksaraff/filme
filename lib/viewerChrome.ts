// lib/viewerChrome.ts
// A tap on a viewer's close button can arrive a moment after the viewer is gone and land on whatever is underneath.
// For a short while after it closes, a clear sheet catches that tap.

let open = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let shield: HTMLElement | null = null;

/** Call when a viewer opens; call the returned function when it closes. Safe to nest and to reopen at once. */
export function absorbStrayTap(): () => void {
  clearTimeout(timer);
  shield?.remove();
  shield = null;
  open++;

  return () => {
    open--;
    if (open > 0) return;
    shield = document.createElement("div");
    shield.setAttribute("aria-hidden", "true");
    shield.style.cssText = "position:fixed;inset:0;z-index:60;background:transparent";
    document.body.appendChild(shield);
    timer = setTimeout(() => {
      if (open > 0) return;
      shield?.remove();
      shield = null;
    }, 400);
  };
}
