// components/PageHeader.tsx
// A page's title with its buttons. On a phone it is a row of its own; on a big landscape screen it rises into the line of the back
// button, the title just to its right and the buttons at the far right.
import type { ReactNode } from "react";

export default function PageHeader({ title, children, inset = "wide:pl-12", className = "" }: { title: string; children?: ReactNode; /** Space to the left on a big screen, to clear the back button. */ inset?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 wide:-mt-[3.25rem] wide:h-10 ${inset} ${className}`}>
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      {children && <span className="flex items-center gap-2">{children}</span>}
    </div>
  );
}
