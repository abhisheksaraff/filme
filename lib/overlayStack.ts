// lib/overlayStack.ts
// Which popup is on top, so Escape closes one at a time.

const stack: symbol[] = [];

export function pushOverlay(): { isTop: () => boolean; remove: () => void } {
  const id = Symbol("overlay");
  stack.push(id);
  return {
    isTop: () => stack[stack.length - 1] === id,
    remove: () => {
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
    },
  };
}
