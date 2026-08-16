import { InventoryCommandCenter } from "@/components/inventory/InventoryCommandCenter";
import { MultiWarehouseControl } from "@/components/inventory/MultiWarehouseControl";
import { WarehouseOperationsControl } from "@/components/inventory/WarehouseOperationsControl";

export default function InventoryPage(){
  return <>
    <MultiWarehouseControl/>
    <WarehouseOperationsControl/>
    <InventoryCommandCenter/>
  </>;
}
