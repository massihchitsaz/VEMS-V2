import { InventoryCommandCenter } from "@/components/inventory/InventoryCommandCenter";
import { MultiWarehouseControl } from "@/components/inventory/MultiWarehouseControl";
import { WarehouseOperationsControl } from "@/components/inventory/WarehouseOperationsControl";
import { InventoryIntelligenceControl } from "@/components/inventory/InventoryIntelligenceControl";
import { InventoryAccessShell } from "@/components/inventory/InventoryAccessShell";

export default function InventoryPage(){
  return <InventoryAccessShell>
    <MultiWarehouseControl/>
    <InventoryIntelligenceControl/>
    <WarehouseOperationsControl/>
    <InventoryCommandCenter/>
  </InventoryAccessShell>;
}
