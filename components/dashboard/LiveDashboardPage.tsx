"use client";
import {ExecutiveDashboardV2} from "@/components/dashboard/ExecutiveDashboardV2";
export function LiveDashboardPage({userId,fullName}:{userId:string;fullName:string}){return <ExecutiveDashboardV2 userId={userId} fullName={fullName}/>}
