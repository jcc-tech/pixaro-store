"use client";
import {useEffect,useState} from "react";
import {tiers, currency, signIn, type MemberView} from "../../lib/membership";
import "./passport.css";

const linkMessages:Record<string,string> = {
  linked:"Discord 帳號已綁定。", taken:"此 Discord 帳號已綁定其他護照。",
  unavailable:"Discord 綁定尚未開放。", expired:"綁定連結已失效，請重新操作。",
  cancelled:"已取消綁定，可隨時再試。", failed:"Discord 綁定未完成，請再試一次。",
};
type Kind = "stamp"|"role";
export default function Membership() {
  const [view,setView]=useState<MemberView|null>(null);
  const [problem,setProblem]=useState("");
  const [notice,setNotice]=useState("");
  const [attempt,setAttempt]=useState(0);
  const [busy,setBusy]=useState("");
  const [effect,setEffect]=useState({key:"",sequence:0});
  useEffect(()=>{
    const abort=new AbortController();
    setProblem("");
    fetch("/api/membership/status",{cache:"no-store",signal:abort.signal}).then(async r=>{
      if(!r.ok) throw Error();
      setView(await r.json());
    }).catch(()=>{if(!abort.signal.aborted)setProblem("無法讀取會員護照。");});
    const outcome=new URLSearchParams(location.search).get("link");
    if(outcome && linkMessages[outcome]) {
      setNotice(linkMessages[outcome]);
      history.replaceState(null,"","/membership");
    }
    return ()=>abort.abort();
  },[attempt]);
  const account=view?.account;
  function animate(tier:number,kind:Kind) {
    setEffect(prev=>({key:tier+"-"+kind,sequence:prev.sequence+1}));
  }
  async function claim(tier:number,name:string,kind:Kind) {
    if(busy) return;
    setBusy(tier+"-"+kind);
    setNotice("");
    try {
      const r=await fetch("/api/membership/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tier,kind})});
      const body=await r.json();
      if(!r.ok || !body.claimed) throw new Error(body.error||"領取未完成，請重試。");
      setView(prev=>prev?.account?{...prev,account:{...prev.account,claims:[...prev.account.claims,{tier,kind}]}}:prev);
      if(kind==="role")window.dispatchEvent(new Event("pixaro-role-updated"));
      animate(tier,kind);
      setNotice(kind==="stamp"?"已將 "+name+" 會員章蓋進護照。":"Discord 已授予你 "+name+" 身分組。");
    } catch(e) { setNotice(e instanceof Error?e.message:"連線中斷，請重新領取。"); }
    finally {setBusy("");}
  }
  return <div className="passPage">
    <nav className="passNav"><a className="passBrand" href="/"><img src="/favicon.svg" alt=""/> PIXARO</a><a href="/">返回商品目錄</a></nav>
    <main className="passMain">
      <div className="passIntro"><div><h1>會員護照</h1><p>每筆實付消費都能累積。達到門檻後，親手蓋下會員章，並在 Pixaro 社群戴上同名身分組。</p><a className="demoLink" href="/membership/playground">試玩商城按鈕特效</a></div>
      <div className="passBalance"><span>累積實付金額</span><strong>{account?currency(account.total):"—"}</strong>
      {account?<small>會員編號 <code>{account.code}</code></small>:problem?<button onClick={()=>setAttempt(n=>n+1)}>{problem} 重新讀取</button>:view?<a href={signIn} target="_top">登入查看我的進度</a>:<small>讀取會員資料中…</small>}</div></div>
      <div className="passGrid">{tiers.map((tier,i)=>{
        const eligible=!!account && account.total>=tier.amount;
        const has=(kind:Kind)=>!!account?.claims.some(c=>c.tier===tier.amount && c.kind===kind);
        const roleOpen=view?.enabledRoles.includes(tier.amount) ?? false;
        function feedback(kind:Kind) {
          if(account) {void claim(tier.amount,tier.name,kind);return;}
          animate(tier.amount,kind);
          setNotice("預覽「"+tier.name+"」"+(kind==="stamp"?"蓋章效果。":"Discord 身分組名片。"));
        }
        return <article className={"passTier "+(i?"deep":"orchid")} key={tier.amount}>
          <div className="passArt">
            <div className="passContour" aria-hidden="true"/>
            <div><p>累積 {currency(tier.amount)}</p><h2>{tier.name}</h2></div>
            <div aria-hidden="true" key={effect.key===tier.amount+"-stamp"?effect.sequence:0} className={"passSeal "+(has("stamp")?"inked ":"")+(effect.key===tier.amount+"-stamp"?"impact":"")}><span>PIXARO</span><b>{i?"≋":"◇"}</b><span>{has("stamp")?"已蓋章":"會員章"}</span></div>
          </div>
          <div className="passDetails">
            {account && <div className="passProgress"><div><span>{eligible?"已達標":"距離解鎖"}</span><strong>{eligible?currency(tier.amount):"還差 "+currency(tier.amount-account.total)}</strong></div><progress aria-label={tier.name+" 消費進度"} max={tier.amount} value={Math.min(tier.amount,account.total)}/></div>}
            <div className="passReward"><div><h3>護照紀念章</h3><p>將這一級的印記收藏在護照中。</p></div>
              <button disabled={!!busy || !!account && (!eligible || has("stamp"))} onClick={()=>feedback("stamp")}>{has("stamp")?"已蓋章":!account?"試蓋一枚":!eligible?"尚未達標":busy===tier.amount+"-stamp"?"蓋章中…":"蓋下會員章"}</button></div>
            <div className="passReward"><div><h3>Discord 身分組</h3><span key={effect.key===tier.amount+"-role"?effect.sequence:0} className={"passRole "+(effect.key===tier.amount+"-role"?"roleFlash":"")}><i/>{tier.name}</span></div>
              <button disabled={!!busy || !!account && (!eligible || has("role") || !account.discordName || !roleOpen)} onClick={()=>feedback("role")}>{has("role")?"已領取":!account?"預覽身分組":!eligible?"尚未達標":!roleOpen?"尚未開放":!account.discordName?"請先綁定":busy===tier.amount+"-role"?"核發中…":"領取身分組"}</button></div>
          </div></article>;
      })}</div>
      <p className="passNotice" role="status">{notice}</p>
      <section className="passConnect"><div><h2>Discord 社群綁定</h2><p>{account?.discordName?"已綁定 @"+account.discordName:view && !view.canLink?"商城正在設定 Discord 核發服務。開放後，即可在此綁定並領取身分組。":"加入 Pixaro 伺服器並綁定本人的 Discord 帳號，即可領取已解鎖的身分組。"}</p></div><div><a href="https://discord.gg/pixaro">加入社群</a>{view?.canLink && !account?.discordName && <a className="passPrimary" target="_top" href={account?"/api/membership/connect":signIn}>{account?"綁定 Discord":"登入並綁定"}</a>}</div></section>
      <p className="passHelp">在 Discord 工單中提供護照上的會員編號，店員核對付款後會將消費登錄至你的護照。</p>
    </main></div>;
}
