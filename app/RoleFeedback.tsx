"use client";
import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
import {listenForPresses, type FeedbackRole} from "../lib/role-feedback";

const previewPath = "/membership/playground";
export default function RoleFeedback() {
  const path=usePathname();
  const role=useRef<FeedbackRole|null>(null);
  useEffect(()=>{
    role.current=null;
    const preview=path===previewPath;
    const stop=listenForPresses(()=>preview ?
      document.querySelector<HTMLInputElement>('input[name="previewRole"]:checked')?.value as FeedbackRole :
      role.current, preview?(held,control)=>{
        if(control.closest(".fxDemo"))return;
        const label=control.getAttribute("aria-label") || control.textContent?.trim() || "按鈕";
        const output=document.getElementById("fx-last-press");
        if(output)output.textContent=label+" · "+(held==="leviathan"?"深海波紋":"紫晶綻放");
      }:undefined);
    if(preview)return stop;
    let pending:AbortController|null=null;
    let lastCheck=0;
    const refresh=async()=>{
      if(document.hidden)return;
      pending?.abort();
      const controller=new AbortController();
      pending=controller;
      lastCheck=Date.now();
      try{
        const response=await fetch("/api/membership/feedback",{cache:"no-store",signal:controller.signal});
        const data=response.ok?await response.json():null;
        if(!controller.signal.aborted)role.current=data?.role??null;
      }catch{if(!controller.signal.aborted)role.current=null;}
    };
    const onVisible=()=>{if(!document.hidden && Date.now()-lastCheck>15000)void refresh();};
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60000);
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("pageshow",onVisible);
    window.addEventListener("pixaro-role-updated",refresh);
    return ()=>{
      pending?.abort();window.clearInterval(timer);stop();
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("pageshow",onVisible);
      window.removeEventListener("pixaro-role-updated",refresh);
    };
  },[path]);
  return null;
}
