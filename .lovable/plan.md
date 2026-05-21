# Edge Function `rooms-rpc` en tu Supabase externo — plan por fases

## Por qué un plan y no "hazlo ya"

El frontend depende de **25 RPCs** y de un motor de Truc Valencià de **~5.000 líneas** (`src/game/engine.ts` 1128, `src/game/bot.ts` 3720, más `deck.ts`, `phrases.ts`, etc.). Para tener "lógica anti-trampas" de verdad, ese motor tiene que correr en el servidor (Deno) — no en el cliente.

Hacerlo todo en un único mensaje produciría miles de líneas de Deno sin testear, casi garantizado roto. Mejor por fases verificables.

## Cómo lo apuntamos a tu Supabase (esto sí, ya)

`src/integrations/supabase/client.ts` ya lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del entorno y solo cae al proyecto Lovable como fallback. Cuando subas a Vercel basta con definir esas dos variables en tu proyecto Vercel apuntando a tu Supabase externo. **No hay que tocar el frontend.**

Las llamadas a `supabase.functions.invoke("rooms-rpc", …)` resuelven automáticamente a `<TU_SUPABASE_URL>/functions/v1/rooms-rpc`.

## Fases

### Fase 1 — Esquema SQL + función vacía desplegable (este mensaje)
- `supabase/functions/rooms-rpc/index.ts` con CORS, router `{ fn, data }`, validación Zod, y stubs que devuelven `{ error: "not_implemented" }`.
- SQL completo: tablas `rooms`, `room_players`, `room_chat`, `room_text_chat`, `room_chat_flags`, `room_chat_flag_audit`, `sala_chat`, `invites`, índices, RLS básica y `REPLICA IDENTITY FULL` para Realtime.
- Variable `ADMIN_PASSWORD` como secret.

### Fase 2 — Salas y presencia
RPCs: `createRoom`, `joinRoom`, `getRoom`, `listLobbyRooms`, `listMyActiveRooms`, `heartbeat`, `leaveRoom`, `setRoomSettings`, `setSeatKind`, `updatePlayerName`, `adminCloseRoom`.
Aquí ya puedes crear salas, sentarte y verlas en el lobby.

### Fase 3 — Chats y moderación
RPCs: `sendChatPhrase`, `sendTextMessage`, `flagPlayerInChat`, `adminListChatFlags`, `adminDecideChatFlag`, `adminListChatFlagAudit`.

### Fase 4 — Motor del juego (la gorda)
Portar `src/game/engine.ts` + `deck.ts` + `types.ts` a `supabase/functions/rooms-rpc/_engine/` (copia, no import desde `src/`). Implementar `startMatch`, `submitAction` con validación servidor-side, `setPaused`, `rematchStay`, `proposeAction`, `respondProposal`, `cancelProposal`. Aquí está el anti-trampas real: el servidor calcula el siguiente estado y solo devuelve la vista filtrada de cada jugador.

### Fase 5 — Bots
Portar `src/game/bot.ts` (3720 líneas) a `_engine/bot.ts` y implementar `advanceBots` con un trigger (cron pg_cron o invocación periódica desde el cliente, como ya hace).

### Fase 6 — Limpieza automática
- Trigger SQL `on update` que pone `status='finished'` cuando la partida acaba.
- Cron `pg_cron` que hace `DELETE FROM rooms WHERE status IN ('finished','abandoned') AND updated_at < now() - interval '1 hour'`. Cascade borra `room_players`, `room_chat`, etc.

## Qué quiero que confirmes antes de empezar Fase 1

1. **¿Tu Supabase externo está creado ya** y tienes acceso al SQL Editor y al deploy de Edge Functions (Supabase CLI o dashboard)?
2. **¿Empiezo por Fase 1 ahora** (SQL + función esqueleto + variables de entorno documentadas) y luego vamos fase por fase confirmando que cada una funciona antes de seguir?
3. **El motor del juego (Fase 4) lo copio tal cual** desde `src/game/engine.ts` a la función — son ~1500 líneas TS puras sin deps de navegador, debería portar limpio. ¿OK?

Si dices "sí, Fase 1", en el siguiente mensaje tendrás el SQL, el `index.ts` esqueleto y las instrucciones exactas para desplegar y para configurar Vercel.
