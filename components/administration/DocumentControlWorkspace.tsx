import {DocumentReadinessControl} from "@/components/administration/DocumentReadinessControl";
import {DocumentCenterV2} from "@/components/administration/DocumentCenterV2";

export function DocumentControlWorkspace(){
  return <>
    <DocumentReadinessControl/>
    <DocumentCenterV2/>
  </>;
}
