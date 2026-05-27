import { ampQuery, table } from "@/lib/amp";
import { clientIp, checkRateLimit } from "@/lib/ratelimit";
import { ApiError, handle } from "@/lib/errors";

// Node runtime gives us a longer timeout window than Edge on Hobby plans
// and lets us reuse the existing ampQuery (Node fetch over the tunnel).
// We cap each connection at 5 minutes so we don't pin a serverless
// instance indefinitely; clients are expected to reconnect (EventSource
// does this automatically).
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2000;
const STREAM_MAX_MS = 5 * 60 * 1000;

type BlockRow = {
  block_num: number;
  timestamp: string;
  gas_used: number;
  base_fee_per_gas: string | null;
};

async function blocksSince(prev: number, tip: number): Promise<BlockRow[]> {
  if (prev >= tip) return [];
  // Cap the per-poll burst — if we somehow fell way behind, only catch
  // up at most 50 blocks per poll so the response stays bounded.
  const from = Math.max(prev + 1, tip - 50);
  const sql = `
    SELECT block_num, timestamp, gas_used, base_fee_per_gas
    FROM ${table("blocks")}
    WHERE block_num BETWEEN ${from} AND ${tip}
    ORDER BY block_num ASC
  `;
  const rows = await ampQuery(sql);
  return rows.map((r) => ({
    block_num: Number(r.block_num),
    timestamp: r.timestamp as string,
    gas_used: Number(r.gas_used),
    base_fee_per_gas: (r.base_fee_per_gas ?? null) as string | null,
  }));
}

function sseFrame(event: string, data: unknown): Uint8Array {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(body);
}

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
  } catch (e) {
    return handle(e);
  }
  const ip = clientIp(req);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let lastTip = 0;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Client disconnect → stop work.
      req.signal.addEventListener("abort", close);

      // Comment line keeps the connection warm against intermediary
      // buffering and immediately signals "we're alive".
      controller.enqueue(
        new TextEncoder().encode(`: connected from ${ip}\n\n`),
      );

      try {
        while (!closed && Date.now() - started < STREAM_MAX_MS) {
          // 1) Find current tip
          const tipRows = await ampQuery(
            `SELECT MAX(block_num) AS tip FROM ${table("blocks")}`,
          );
          const tip = Number(tipRows[0]?.tip ?? 0);
          if (tip > 0 && lastTip === 0) lastTip = tip - 1; // catch-up from "now"

          // 2) Pull anything new
          if (tip > lastTip) {
            const rows = await blocksSince(lastTip, tip);
            for (const row of rows) {
              if (closed) break;
              controller.enqueue(sseFrame("block", row));
              lastTip = row.block_num;
            }
          } else {
            controller.enqueue(sseFrame("heartbeat", { tip, ts: Date.now() }));
          }

          // 3) Wait
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
        // Graceful: tell the client we hit the per-connection cap so they
        // know to reconnect (EventSource does this for them anyway).
        controller.enqueue(
          sseFrame("close", { reason: "max_duration", reconnect: true }),
        );
      } catch (e) {
        controller.enqueue(
          sseFrame("error", {
            message: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx-style proxy buffering
    },
  });
}
