"use client";
import { useEffect, useState } from "react";
export function useLocalStorage<T>(key:string, initialValue:T){
 const [value,setValue]=useState<T>(initialValue); const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{try{const stored=localStorage.getItem(key); if(stored) setValue(JSON.parse(stored) as T);}catch{}finally{setHydrated(true)}},[key]);
 useEffect(()=>{if(hydrated) localStorage.setItem(key,JSON.stringify(value));},[hydrated,key,value]);
 return [value,setValue] as const;
}
