"use client";

import { useEffect, useRef } from "react";
import { ShipmentsWorkspace } from "@/components/shipping/ShipmentsWorkspace";

function markControlled(select: HTMLSelectElement) {
  select.disabled = true;
  select.tabIndex = -1;
  select.setAttribute("aria-disabled", "true");
  select.setAttribute("aria-label", "Shipment status managed by Shipment Execution Gate");
  select.title = "Status changes are managed only through Shipment Execution Gate";
  select.dataset.controlledStatus = "true";
}

function hardenStatusControls(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
    const statusIndex = headers.findIndex((header) => header.textContent?.trim().toLowerCase() === "status");
    if (statusIndex < 0) return;
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      const cell = row.cells.item(statusIndex);
      const select = cell?.querySelector<HTMLSelectElement>("select");
      if (select) markControlled(select);
    });
  });

  root.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
    const select = label.querySelector<HTMLSelectElement>("select");
    if (!select) return;
    const labelText = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() || "")
      .join(" ")
      .trim()
      .toLowerCase();
    if (labelText === "status") markControlled(select);
  });
}

export function ControlledShipmentsWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => hardenStatusControls(root);
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="controlled-shipments-workspace">
      <div className="mx-5 mt-5 rounded-2xl border border-blue-900/70 bg-blue-950/20 px-4 py-3 text-sm text-blue-100 md:mx-8">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Controlled shipment lifecycle</p>
            <p className="mt-1 text-xs text-blue-200/75">
              Shipment status is read-only in the register and edit form. Lifecycle changes, cancellations and manager overrides are executed only through the Shipment Execution Gate above.
            </p>
          </div>
          <span className="mt-2 inline-flex w-fit rounded-full border border-blue-800 bg-blue-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300 md:mt-0">
            Gate Controlled
          </span>
        </div>
      </div>
      <ShipmentsWorkspace />
      <style jsx global>{`
        .controlled-shipments-workspace select[data-controlled-status="true"] {
          appearance: none;
          -webkit-appearance: none;
          cursor: default;
          opacity: 1;
          color: rgb(191 219 254);
          border-color: rgb(30 64 175 / 0.65);
          background: rgb(23 37 84 / 0.35);
          font-weight: 600;
          text-transform: capitalize;
        }
        .controlled-shipments-workspace select[data-controlled-status="true"]:disabled {
          -webkit-text-fill-color: rgb(191 219 254);
        }
      `}</style>
    </div>
  );
}
