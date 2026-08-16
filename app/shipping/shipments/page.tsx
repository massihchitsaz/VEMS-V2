import { ShipmentExecutionGate } from "@/components/shipping/ShipmentExecutionGate";
import { ControlledShipmentsWorkspace } from "@/components/shipping/ControlledShipmentsWorkspace";

export default function ShipmentsPage(){
  return <>
    <ShipmentExecutionGate/>
    <ControlledShipmentsWorkspace/>
  </>;
}
