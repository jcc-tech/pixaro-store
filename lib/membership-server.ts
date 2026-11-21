import { tiers, callbackPath, signIn } from "./membership";
import { getD1 } from "../db";

type Database = Awaited<ReturnType<typeof getD1>>;
type Settings = Record<string,string | undefined>;
type Member = {code:string; discord_id:string|null; discord_name:string|null};
const discord = "https://discord.com/api/v10";
const noCache = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const json = (body:unknown,status=200) => Response.json(body,{status,headers:noCache});
const fail = (error:string,status:number) => json({error},status);
const go = (url:string) => new Response(null,{status:303,headers:{...noCache,Location:url}});
const result = (status:string) => go("/membership?link="+status);
const snowflake = (value:unknown) => typeof value === "string" && /^\d{17,20}$/.test(value);

function config(settings:Settings) {
  const canLink = snowflake(settings.DISCORD_CLIENT_ID) && Boolean(settings.DISCORD_CLIENT_SECRET);
  const enabledRoles = tiers.filter(t => settings.DISCORD_BOT_TOKEN && snowflake(settings.DISCORD_GUILD_ID) && snowflake(settings[t.roleKey])).map(t=>t.amount);
  return {canLink,enabledRoles};
}
async function memberFor(db:Database, owner:string) {
  const query = () => db.prepare("SELECT code, discord_id, discord_name FROM members WHERE owner=?").bind(owner).first<Member>();
  let member = await query();
  if (!member) {
    const code = "PX-"+crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase();
    await db.prepare("INSERT INTO members(code,owner) VALUES(?,?) ON CONFLICT(owner) DO NOTHING").bind(code,owner).run();
    member = await query();
  }
  if (!member) throw new Error("Member unavailable");
  return member;
}
async function totalFor(db:Database,code:string) {
  return await db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM member_sales WHERE member=?").bind(code).first<number>("total") ?? 0;
}
async function recordSale(db:Database, data:Record<string,unknown>, staff:string) {
  const code = String(data.code ?? "").trim().toUpperCase();
  const receipt = String(data.receipt ?? "").trim();
  const amount = data.amount;
  if (!/^PX-[A-F0-9]{16}$/.test(code) || !receipt || receipt.length>100 || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount<=0 || amount>99999999)
    return fail("請檢查會員編號、訂單編號與實付金額。",400);
  if (!await db.prepare("SELECT code FROM members WHERE code=?").bind(code).first()) return fail("查無此會員，請重新核對編號。",404);
  const inserted = await db.prepare("INSERT INTO member_sales(receipt,member,amount,recorded_by) VALUES(?,?,?,?) ON CONFLICT(receipt) DO NOTHING").bind(receipt,code,amount,staff).run();
  if (!inserted.meta.changes) {
    const prior = await db.prepare("SELECT member,amount FROM member_sales WHERE receipt=?").bind(receipt).first<{member:string;amount:number}>();
    if (prior?.member!==code || prior.amount!==amount) return fail("這個訂單編號已有不同的登錄資料，請核對原始訂單。",409);
  }
  return json({message:inserted.meta.changes?"已登錄這筆消費。":"這筆訂單已登錄，金額只計入一次。",total:await totalFor(db,code)});
}

export async function membershipRequest(request:Request, action:string, db:Database, settings:Settings, isManager:()=>Promise<boolean>, send:typeof fetch=fetch) {
  const url = new URL(request.url);
  const owner = request.headers.get("oai-authenticated-user-id");
  const options = config(settings);
  if (request.method==="POST" && request.headers.get("origin")!==url.origin) return fail("請從商城頁面操作。",403);
  if (request.method==="POST" && action==="sale") {
    if (!owner || !await isManager()) return fail("需要管理權限。",403);
    const data = await request.json().catch(()=>null);
    if (!data || typeof data!=="object") return fail("訂單資料格式有誤。",400);
    return recordSale(db,data,owner);
  }
  if (request.method==="GET" && action==="feedback") {
    if (!owner || !options.enabledRoles.length) return json({role:null});
    const linked = await db.prepare("SELECT discord_id FROM members WHERE owner=?").bind(owner).first() as {discord_id:string|null}|null;
    if (!linked?.discord_id) return json({role:null});
    const response = await send(discord+"/guilds/"+settings.DISCORD_GUILD_ID+"/members/"+linked.discord_id, {
      headers:{Authorization:"Bot "+settings.DISCORD_BOT_TOKEN},
    });
    if (!response.ok) return json({role:null},response.status===404?200:503);
    const member = await response.json() as {roles?:string[]};
    const held = [...tiers].reverse().find(t=>options.enabledRoles.includes(t.amount) && member.roles?.includes(settings[t.roleKey]!));
    return json({role:held?.name??null});
  }
  if (!owner) {
    if (request.method==="GET" && action==="status") return json({...options,account:null});
    if (request.method==="GET" && action==="connect") return go(signIn);
    return fail("請先登入會員護照。",401);
  }
  const member = await memberFor(db,owner);
  if (request.method==="GET" && action==="status") {
    const total = await totalFor(db,member.code);
    const claims = await db.prepare("SELECT tier,kind FROM member_claims WHERE member=? ORDER BY tier,kind").bind(member.code).all();
    return json({...options,account:{code:member.code,discordName:member.discord_name,total,claims:claims.results}});
  }

  const redirectUri = url.origin+callbackPath;
  if (request.method==="GET" && action==="connect") {
    if (member.discord_id) return result("linked");
    if (!options.canLink) return result("unavailable");
    const state = crypto.randomUUID();
    await db.prepare("UPDATE members SET link_state=?,link_expires=? WHERE code=?").bind(state,Date.now()+600000,member.code).run();
    const auth = new URL("https://discord.com/oauth2/authorize");
    auth.search = new URLSearchParams({client_id:settings.DISCORD_CLIENT_ID!,response_type:"code",redirect_uri:redirectUri,scope:"identify",state,prompt:"consent"}).toString();
    return go(auth.href);
  }
  if (request.method==="GET" && action==="callback") {
    const state=url.searchParams.get("state");
    if (!state || !options.canLink) return result("expired");
    const used = await db.prepare("UPDATE members SET link_state=NULL,link_expires=NULL WHERE code=? AND link_state=? AND link_expires>=? AND discord_id IS NULL").bind(member.code,state,Date.now()).run();
    if (!used.meta.changes) return result("expired");
    const code=url.searchParams.get("code");
    if (!code) return result("cancelled");
    try {
      const token = await send(discord+"/oauth2/token",{method:"POST",body:new URLSearchParams({grant_type:"authorization_code",client_id:settings.DISCORD_CLIENT_ID!,client_secret:settings.DISCORD_CLIENT_SECRET!,code,redirect_uri:redirectUri})});
      if (!token.ok) return result("failed");
      const auth = await token.json() as {access_token?:string};
      if (!auth.access_token) return result("failed");
      const profile = await send(discord+"/users/@me",{headers:{Authorization:"Bearer "+auth.access_token}});
      if (!profile.ok) return result("failed");
      const user = await profile.json() as {id:string;username:string};
      if (!snowflake(user.id) || !user.username) return result("failed");
      const saved = await db.prepare("UPDATE OR IGNORE members SET discord_id=?,discord_name=? WHERE code=? AND discord_id IS NULL").bind(user.id,user.username,member.code).run();
      return result(saved.meta.changes?"linked":"taken");
    } catch { return result("failed"); }
  }

  if (request.method!=="POST" || action!=="claim") return fail("找不到此操作。",404);
  const data=await request.json().catch(()=>null);
  const tier=tiers.find(t=>t.amount===data?.tier);
  const kind=data?.kind;
  if (!tier || (kind!=="stamp" && kind!=="role")) return fail("請選擇有效的回饋。",400);
  if (await totalFor(db,member.code)<tier.amount) return fail("累積實付金額尚未達標。",403);
  const args=[member.code,tier.amount,kind];
  if (await db.prepare("SELECT 1 FROM member_claims WHERE member=? AND tier=? AND kind=?").bind(...args).first()) return json({claimed:true});
  if (kind==="role") {
    if (!options.enabledRoles.some(n=>n===tier.amount)) return fail("此身分組尚未開放發放。",503);
    if (!member.discord_id) return fail("請先綁定 Discord 帳號。",409);
    const granted = await send(discord+"/guilds/"+settings.DISCORD_GUILD_ID+"/members/"+member.discord_id+"/roles/"+settings[tier.roleKey],{method:"PUT",headers:{Authorization:"Bot "+settings.DISCORD_BOT_TOKEN}});
    if (granted.status===404) {
      const detail=await granted.json().catch(()=>({})) as {code?:number};
      return detail.code===10007 ? fail("請先加入 Pixaro Discord 社群，再回來領取。",409) : fail("找不到設定的伺服器或身分組，請聯絡管理員。",503);
    }
    if(granted.status!==204) return fail(granted.status===429?"Discord 忙碌中，請稍後再領取。":"Discord 尚未核發身分組，請稍後再試或聯絡管理員。",503);
  }
  await db.prepare("INSERT INTO member_claims(member,tier,kind) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(...args).run();
  return json({claimed:true});
}
