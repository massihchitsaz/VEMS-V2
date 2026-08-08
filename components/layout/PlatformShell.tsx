"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { navigationGroups } from "@/components/navigation/menu";
import { createClient } from "@/lib/supabase/client";

type UserProfile={id:string;fullName:string;role:string;email:string};
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

function isActivePath(pathname:string,href:string){return href==="/"||href==="/fx"?pathname===href:pathname===href||pathname.startsWith(`${href}/`)}
function getPageTitle(pathname:string){const items=navigationGroups.flatMap(g=>g.items);return items.find(i=>i.href===pathname)?.label||[...items].sort((a,b)=>b.href.length-a.href.length).find(i=>pathname.startsWith(`${i.href}/`))?.label||"VTC ONE"}
function canSeeGroup(role:string,label:string){const r=role.toLowerCase();if(r==="admin"||r==="ceo")return true;if(r==="finance")return ["Overview","Treasury","Finance","Management"].includes(label);if(r==="manager")return label!=="Management"||true;if(r==="dealer")return ["Overview","Commercial","Logistics","Management"].includes(label);return label==="Overview"}
function canSeeItem(role:string,href:string){const r=role.toLowerCase();if(r==="admin"||r==="ceo")return true;if(["/users","/admin/roles","/settings","/audit"].includes(href))return r==="manager";return true}

export function PlatformShell({children}:{children:React.ReactNode}){
 const pathname=usePathname();const router=useRouter();const isLogin=pathname==="/login";
 const[sidebarOpen,setSidebarOpen]=useState(false);const[user,setUser]=useState<UserProfile|null>(null);const[loading,setLoading]=useState(!isLogin);const[unread,setUnread]=useState(0);const[query,setQuery]=useState("");const[installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
 const pageTitle=useMemo(()=>getPageTitle(pathname),[pathname]);
 const groups=useMemo(()=>{if(!user)return[];return navigationGroups.filter(g=>canSeeGroup(user.role,g.label)).map(g=>({...g,items:g.items.filter(i=>canSeeItem(user.role,i.href))})).filter(g=>g.items.length)},[user]);

 useEffect(()=>{setSidebarOpen(false)},[pathname]);
 useEffect(()=>{const handler=(e:Event)=>{e.preventDefault();setInstallPrompt(e as InstallPromptEvent)};window.addEventListener("beforeinstallprompt",handler);return()=>window.removeEventListener("beforeinstallprompt",handler)},[]);
 useEffect(()=>{
  if(isLogin){setLoading(false);return}
  let mounted=true;const s=createClient();
  const load=async()=>{const{data:{user:authUser}}=await s.auth.getUser();if(!authUser){router.replace("/login");return}const{data:p,error}=await s.from("profiles").select("id,full_name,role,active").eq("id",authUser.id).single();if(error||!p||p.active===false){await s.auth.signOut();router.replace("/login");return}if(!mounted)return;setUser({id:p.id,fullName:p.full_name||authUser.email||"VTC User",role:String(p.role||"dealer"),email:authUser.email||""});const{count}=await s.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",authUser.id).eq("is_read",false);if(mounted)setUnread(count??0);setLoading(false)};void load();
  const{data:{subscription}}=s.auth.onAuthStateChange((_event,session)=>{if(!session&&!isLogin)router.replace("/login")});return()=>{mounted=false;subscription.unsubscribe()}
 },[isLogin,router]);

 async function logout(){const s=createClient();await s.auth.signOut();router.replace("/login");router.refresh()}
 function search(e:FormEvent){e.preventDefault();const q=query.trim();if(q)router.push(`/search?q=${encodeURIComponent(q)}`)}
 async function install(){if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)}
 if(isLogin)return <>{children}</>;
 if(loading||!user)return <main className="flex min-h-screen items-center justify-center bg-[#060a12] text-slate-400">Loading VTC ONE...</main>;

 const sidebar=<aside className="flex h-full w-[280px] flex-col border-r border-slate-800 bg-[#08101f]">
  <div className="flex h-20 items-center border-b border-slate-800 px-5"><Link href="/" className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">V</span><span><span className="block font-bold text-white">VTC ONE</span><span className="block text-xs text-slate-500">Enterprise Operations Platform</span></span></Link></div>
  <nav className="flex-1 overflow-y-auto px-3 py-5">{groups.map(group=><div key={group.label} className="mb-6"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">{group.label}</p><div className="space-y-1">{group.items.map(item=>{const active=isActivePath(pathname,item.href);return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active?"bg-blue-600 text-white":"text-slate-400 hover:bg-slate-800/70 hover:text-white"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">{item.icon}</span><span className="flex-1 font-medium">{item.label}</span></Link>})}</div></div>)}</nav>
  <div className="border-t border-slate-800 p-4"><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="truncate text-sm font-semibold text-white">{user.fullName}</p><p className="mt-1 text-xs capitalize text-slate-500">{user.role}</p>{installPrompt&&<button onClick={install} className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-left text-xs font-semibold text-white">Install VTC ONE App</button>}<button onClick={logout} className="mt-2 w-full rounded-xl border border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:border-red-500/40 hover:text-red-300">Sign out</button></div></div>
 </aside>;

 return <div className="min-h-screen bg-[#060a12] text-slate-100"><div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>{sidebarOpen&&<div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={()=>setSidebarOpen(false)} className="absolute inset-0 bg-black/70"/><div className="relative h-full w-[280px]">{sidebar}</div></div>}<div className="min-h-screen lg:pl-[280px]"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-800 bg-[#070d18]/95 px-4 backdrop-blur md:px-7"><div className="flex items-center gap-4"><button onClick={()=>setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 lg:hidden">☰</button><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">VTC Enterprise Management System</p><h1 className="mt-1 text-lg font-semibold text-white md:text-xl">{pageTitle}</h1></div></div><div className="flex items-center gap-2 md:gap-3"><form onSubmit={search} className="hidden xl:block"><label className="relative block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Search VTC ONE..." className="w-64 rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500"/></label></form><Link href="/notifications" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">●{unread>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">{unread>99?"99+":unread}</span>}</Link><div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 sm:block"><p className="max-w-44 truncate text-sm font-medium text-white">{user.fullName}</p><p className="text-xs capitalize text-slate-500">{user.role}</p></div></div></header><div className="min-h-[calc(100vh-5rem)]">{children}</div></div></div>
}
