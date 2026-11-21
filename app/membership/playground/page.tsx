"use client";
import {useState} from "react";
import Store from "../../Store";
import "./playground.css";

export default function Playground(){
  const [role,setRole]=useState("rich client");
  return <><section className="fxDemo" aria-label="商城按鈕特效試玩">
    <div><h1>試玩商城按鈕特效</h1><p>選一個身分，再點下方商品、收藏或遊戲分類。</p><output key={role} id="fx-last-press" aria-live="polite">{role==="none"?"一般訪客使用原本的按鈕效果。":"點下按鈕後，這裡會顯示剛才觸發的特效。"}</output></div>
    <fieldset><legend>模擬身分組</legend>{[
      ["none","一般訪客","一般回饋"],["rich client","rich client","紫晶綻放"],["leviathan","leviathan","深海波紋"]
    ].map(([key,name,effect])=><label htmlFor={"fx-"+key} key={key}>
      <input id={"fx-"+key} name="previewRole" type="radio" checked={role===key} value={key} onChange={()=>setRole(key)}/>
      <span><strong>{name}</strong><small>{effect}</small></span></label>)}</fieldset>
    </section><Store preview/></>;
}
