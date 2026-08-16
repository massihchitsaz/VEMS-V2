import { InventoryCommandCenter } from "@/components/inventory/InventoryCommandCenter";
import { MultiWarehouseControl } from "@/components/inventory/MultiWarehouseControl";

export default function InventoryPage(){
  return <>
    <MultiWarehouseControl/>
    <InventoryCommandCenter/>
  </>;
}
