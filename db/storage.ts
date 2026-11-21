export async function getBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) {
    throw new Error(
      "Cloudflare R2 binding `BUCKET` is unavailable. Set the `r2` field in .openai/hosting.json to `BUCKET`.",
    );
  }
  return env.BUCKET;
}
