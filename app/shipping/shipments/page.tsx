import { ShipmentExecutionGate } from "@/components/shipping/ShipmentExecutionGate";
import { ShipmentsWorkspace } from "@/components/shipping/ShipmentsWorkspace";

export default function ShipmentsPage(){
  return <>
    <ShipmentExecutionGate/>
    <ShipmentsWorkspace/>
  </>;
}
