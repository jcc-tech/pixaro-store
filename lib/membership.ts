export const tiers = [
  { amount: 10000, name: "rich client", roleKey: "DISCORD_RICH_CLIENT_ROLE_ID" },
  { amount: 50000, name: "leviathan", roleKey: "DISCORD_LEVIATHAN_ROLE_ID" },
] as const;

export const callbackPath = "/api/membership/callback";
export const signIn = "/signin-with-chatgpt?return_to=%2Fmembership";
export const currency = (n: number) => "NT$" + n.toLocaleString("zh-TW");

export type Passport = {
  code: string;
  total: number;
  discordName: string | null;
  claims: { tier: number; kind: string }[];
};
export type MemberView = {
  account: Passport | null;
  canLink: boolean;
  enabledRoles: number[];
};
