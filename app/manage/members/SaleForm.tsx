"use client";
import { useState } from "react";
import { currency } from "../../../lib/membership";
export default function SaleForm(){
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  return <form className="auth-form" onSubmit={async e=>{
    e.preventDefault();
    if(busy)return;
    const form=e.currentTarget,fields=new FormData(form);
    setBusy(true);setMessage("");
    try {
      const res=await fetch("/api/membership/sale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:fields.get("code"),receipt:fields.get("receipt"),amount:Number(fields.get("amount"))})});
      const body=await res.json();
      if(res.ok){setMessage(body.message+" 目前累積 "+currency(body.total));form.reset();}
      else setMessage(body.error||"登錄未完成。");
    } catch {setMessage("連線中斷，可使用相同訂單編號重試。");}
    finally{setBusy(false);}
  }}>
    <p>核對工單與實付金額後登錄；同一訂單只會計入一次。</p>
    <label>會員編號<input required name="code" placeholder="PX-…" maxLength={19}/></label>
    <label>已付款訂單編號<input required name="receipt" maxLength={100}/></label>
    <label>實付金額（新台幣）<input name="amount" type="number" step={1} min={1} max={99999999} required/></label>
    <button className="primary-button" disabled={busy}>{busy?"登錄中…":"確認登錄"}</button><p role="status">{message}</p>
  </form>;
}
