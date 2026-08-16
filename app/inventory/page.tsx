import { InventoryCommandCenter } from "@/components/inventory/InventoryCommandCenter";
import { MultiWarehouseControl } from "@/components/inventory/MultiWarehouseControl";
import { WarehouseOperationsControl } from "@/components/inventory/WarehouseOperationsControl";
import { InventoryIntelligenceControl } from "@/components/inventory/InventoryIntelligenceControl";

export default function InventoryPage(){
  return <>
    <MultiWarehouseControl/>
    <InventoryIntelligenceControl/>
    <WarehouseOperationsControl/>
    <InventoryCommandCenter/>
  </>;
}
