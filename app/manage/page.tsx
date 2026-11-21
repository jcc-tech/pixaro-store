import Manager from "./Manager";
import { managerAccess } from "../../lib/manager";
export const dynamic = "force-dynamic";
export default async function ManagePage() {
  const access = await managerAccess();
  if (access === "manager") return <Manager />;
  return <main className="auth-shell"><section className="auth-card"><h1>商品管理</h1>
    {access === "anonymous" ? <a href="/signin-with-chatgpt?return_to=%2Fmanage" target="_top">使用管理者帳號登入</a> : <p>此帳號沒有管理權限。</p>}
    <p><a href="/">返回商城</a></p></section></main>;
}
