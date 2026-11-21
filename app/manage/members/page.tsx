import { managerAccess } from "../../../lib/manager";
import SaleForm from "./SaleForm";
export const dynamic="force-dynamic";
export default async function MemberSales(){
  const access=await managerAccess();
  return <main className="auth-shell"><section className="auth-card"><h1>會員消費登錄</h1>
    {access==="manager"?<SaleForm/>:access==="anonymous"?<a href="/signin-with-chatgpt?return_to=%2Fmanage%2Fmembers" target="_top">使用管理者帳號登入</a>:<p>此帳號沒有管理權限。</p>}
    <p><a href="/manage">返回管理中心</a></p></section></main>;
}
