// components/PageHeader.tsx
// A page's title with its buttons. On a phone it is a row of its own; on a big landscape screen it rises into the line of the back
// button and sits in one column of the same width on every page: the title 20 px after the back button, the buttons at the far right.
import type { ReactNode } from "react";

export default function PageHeader({ title, children, className = "" }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 wide:relative wide:left-1/2 wide:-mt-[3.25rem] wide:h-10 wide:w-[min(100vw,64rem)] wide:-translate-x-1/2 wide:pl-[5.75rem] wide:pr-4 ${className}`}>
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      {children && <span className="flex items-center gap-2">{children}</span>}
    </div>
  );
}
