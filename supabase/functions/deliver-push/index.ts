// Invoke every minute using a server-side scheduler, Authorization: Bearer PUSH_WORKER_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
const client = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);
const allowedHosts = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];
function safeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      (!url.port || url.port === "443") &&
      allowedHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith("." + host),
      )
    );
  } catch {
    return false;
  }
}
Deno.serve(async (request) => {
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const { data: jobs, error } = await client.rpc("claim_push_jobs");
  if (error)
    return Response.json({ error: "Cannot claim jobs" }, { status: 500 });
  let completed = 0,
    failed = 0;
  for (const job of jobs || []) {
    try {
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("active")
        .eq("id", job.user_id)
        .single();
      if (profileError) throw profileError;
      if (profile?.active) {
        const { data: subscriptions, error: subscriptionError } = await client
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", job.user_id);
        if (subscriptionError) throw subscriptionError;
        for (const subscription of subscriptions || []) {
          if (
            !safeEndpoint(subscription.endpoint) ||
            subscription.subscription?.endpoint !== subscription.endpoint
          ) {
            await client
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
            continue;
          }
          try {
            await webpush.sendNotification(
              subscription.subscription,
              JSON.stringify({
                title: "Plástico · Nueva convocatoria",
                body: "Tenés novedades en tu espacio. Ingresá para confirmar tu asistencia.",
              }),
              { TTL: 86400, timeout: 10000 },
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await client
                .from("push_subscriptions")
                .delete()
                .eq("id", subscription.id);
            else throw error;
          }
        }
      }
      const { error: finishError } = await client
        .from("push_jobs")
        .update({ completed_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (finishError) throw finishError;
      completed++;
    } catch {
      failed++;
      await client
        .from("push_jobs")
        .update({
          last_error: "Delivery failed; inspect worker logs",
          available_at: new Date(
            Date.now() + Math.min(60, 2 ** job.attempts) * 60000,
          ).toISOString(),
        })
        .eq("id", job.id);
    }
  }
  return Response.json({ completed, failed });
});
