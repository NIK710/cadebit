"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  children,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initialFocus =
      dialogRef.current?.querySelector<HTMLElement>(
        "[data-modal-initial-focus]",
      ) ?? closeRef.current;
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-y-auto border border-black bg-white p-5 ${wide ? "max-w-3xl" : "max-w-md"}`}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-300 pb-3">
          <h2 className="text-xl font-semibold" id={titleId}>
            {title}
          </h2>
          <button
            className="border border-black px-2 py-1 text-xs hover:bg-zinc-100"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
