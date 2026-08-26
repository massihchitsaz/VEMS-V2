import { InventoryAccessShell } from "@/components/inventory/InventoryAccessShell";
import { InventoryModuleShell } from "@/components/inventory/InventoryModuleShell";

export default function InventoryPage() {
  return <InventoryAccessShell>
    <InventoryModuleShell />
  </InventoryAccessShell>;
}
