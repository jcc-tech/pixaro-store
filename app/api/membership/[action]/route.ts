import { getD1 } from "../../../../db";
import { managerAccess } from "../../../../lib/manager";
import { membershipRequest } from "../../../../lib/membership-server";
export const dynamic = "force-dynamic";
async function handle(request:Request, context:{params:Promise<{action:string}>}) {
  const {action}=await context.params;
  try {
    const {env}=await import("cloudflare:workers");
    return await membershipRequest(request,action,await getD1(),env as unknown as Record<string,string>,async()=>(await managerAccess())==="manager");
  } catch {
    return Response.json({error:"目前無法完成操作，請稍後重試。"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
export {handle as GET,handle as POST};
