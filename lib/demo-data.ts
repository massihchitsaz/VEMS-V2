import type { Deal, User } from "@/types";
export const initialUsers:User[]=[
{id:"user-admin",username:"admin",password:"VTC2026",fullName:"Massih Chitsaz",role:"Admin",active:true},
{id:"user-dealer-1",username:"dealer1",password:"Dealer2026",fullName:"Demo Dealer",role:"Dealer",active:true},
{id:"user-finance-1",username:"finance",password:"Finance2026",fullName:"Finance User",role:"Finance",active:true}
];
export const initialDeals:Deal[]=[
{id:"VTC-1052",customer:"Orange Group",pair:"USD/AED",amount:1250000,currency:"USD",rate:3.6735,profit:18750,status:"Completed",dealerId:"user-admin",createdAt:"2026-07-24T08:30:00.000Z",updatedAt:"2026-07-24T08:30:00.000Z"},
{id:"VTC-1051",customer:"Al Noor Trading",pair:"EUR/AED",amount:680000,currency:"EUR",rate:4.301,profit:12400,status:"Pending",dealerId:"user-dealer-1",createdAt:"2026-07-24T07:15:00.000Z",updatedAt:"2026-07-24T07:15:00.000Z"}
];
