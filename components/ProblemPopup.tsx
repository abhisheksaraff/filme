// components/ProblemPopup.tsx
// Tells the person something went wrong in the same popup as everything else, with a single OK. Shows nothing while there is no problem.
"use client";

import { NoticePopup } from "@/components/Popup";

export default function ProblemPopup({ message, onClose }: { message: string | null | undefined; onClose: () => void }) {
  if (!message) return null;
  return <NoticePopup title="Something went wrong" message={message} onClose={onClose} />;
}
