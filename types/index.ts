export type Role = "Admin" | "Manager" | "Dealer" | "Finance";
export type PageName = "Dashboard" | "Deals" | "Users" | "Reports";
export type DealStatus = "Completed" | "Pending" | "Review";
export type User = { id:string; username:string; password:string; fullName:string; role:Role; active:boolean };
export type Deal = { id:string; customer:string; pair:string; amount:number; currency:string; rate:number; profit:number; status:DealStatus; dealerId:string; createdAt:string; updatedAt:string };
