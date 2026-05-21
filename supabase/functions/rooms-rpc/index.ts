// Edge Function: rooms-rpc
// Fase 1 — esqueleto desplegable con CORS, router { fn, data }, validación Zod,
// y stubs que devuelven `{ error: "not_implemented" }` para cada RPC.
//
// Despliegue en tu Supabase externo:
//   supabase functions deploy rooms-rpc --no-verify-jwt
//
// Variables que esta función usa (configurar en el dashboard de Supabase,
// Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL              (la inyecta Supabase automáticamente)
//   SUPABASE_SERVICE_ROLE_KEY (la inyecta Supabase automáticamente)
//   ADMIN_PASSWORD            (tú la defines: contraseña para RPCs admin*)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Service-role client: la función opera con privilegios elevados,
// por eso toda la autorización (host, deviceId, password) se hace
// dentro de cada handler, NO con RLS.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// ---------------------------------------------------------------------------
// Registro de RPCs. En las próximas fases iremos rellenando los handlers.
// ---------------------------------------------------------------------------

type Handler = (data: unknown) => Promise<unknown>;

const notImplemented: Handler = async () => {
  throw new Error("not_implemented");
};

const handlers: Record<string, Handler> = {
  // Fase 2 — salas y presencia
  createRoom: notImplemented,
  joinRoom: notImplemented,
  getRoom: notImplemented,
  listLobbyRooms: notImplemented,
  listMyActiveRooms: notImplemented,
  heartbeat: notImplemented,
  leaveRoom: notImplemented,
  setRoomSettings: notImplemented,
  setSeatKind: notImplemented,
  updatePlayerName: notImplemented,
  adminCloseRoom: notImplemented,

  // Fase 3 — chats y moderación
  sendChatPhrase: notImplemented,
  sendTextMessage: notImplemented,
  flagPlayerInChat: notImplemented,
  adminListChatFlags: notImplemented,
  adminDecideChatFlag: notImplemented,
  adminListChatFlagAudit: notImplemented,

  // Fase 4 — motor del juego (anti-trampas en servidor)
  startMatch: notImplemented,
  submitAction: notImplemented,
  setPaused: notImplemented,
  rematchStay: notImplemented,
  proposeAction: notImplemented,
  respondProposal: notImplemented,
  cancelProposal: notImplemented,

  // Fase 5 — bots
  advanceBots: notImplemented,
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  fn: z.string().min(1),
  data: z.unknown().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_body" }, 400);
  }

  const { fn, data } = parsed.data;
  const handler = handlers[fn];
  if (!handler) {
    return json({ error: `unknown_fn:${fn}` }, 400);
  }

  try {
    const result = await handler(data);
    return json(result ?? { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // No filtramos stack al cliente.
    return json({ error: msg }, msg === "not_implemented" ? 501 : 400);
  }
});

// Exportado solo para tests futuros.
export { handlers, supabase };
