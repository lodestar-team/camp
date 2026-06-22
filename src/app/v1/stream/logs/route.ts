import { ampQuery, table, hexLiteral, hexCol } from "@/lib/amp";
import { clientIp, checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, topicParam } from "@/lib/validate";

// Live SSE feed of new logs matching an optional address/topic0 filter — the
// building block for alerting ("ping me when this contract emits an event" /
// "watch USDC Transfers"). Subscribe with EventSource; each `log` event is one
// matching log. Same 5-minute per-connection cap as /v1/stream/blocks; clients
// reconnect automatically. (We don't push to a caller-supplied webhook URL —
// that needs delivery infra a single free node shouldn't promise. SSE pull is
// the supported primitive; bridge it to your own webhook/queue if you need.)
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2000;
const STREAM_MAX_MS = 5 * 60 * 1000;
const MAX_CATCHUP_BLOCKS = 50; // bound how far behind we replay per poll
const MAX_ROWS_PER_POLL = 100; // bound the burst when a filter is broad

function sseFrame(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
  let address: string | null;
  let topic0: string | null;
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    const addrRaw = url.searchParams.get("address");
    const topicRaw = url.searchParams.get("topic0");
    address = addrRaw ? addressParam.parse(addrRaw) : null;
    topic0 = topicRaw ? topicParam.parse(topicRaw) : null;
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
  const ip = clientIp(req);

  const filterSql = [
    address ? `AND address = ${hexLiteral(address)}` : "",
    topic0 ? `AND topic0 = ${hexLiteral(topic0)}` : "",
  ].join(" ");

  async function logsSince(prev: number, tip: number) {
    if (prev >= tip) return [];
    const from = Math.max(prev + 1, tip - MAX_CATCHUP_BLOCKS);
    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("address")} AS address,
        ${hexCol("topic0")}  AS topic0,
        ${hexCol("topic1")}  AS topic1,
        ${hexCol("topic2")}  AS topic2,
        ${hexCol("topic3")}  AS topic3,
        encode(data, 'hex')  AS data
      FROM ${table("logs")}
      WHERE block_num BETWEEN ${from} AND ${tip} ${filterSql}
      ORDER BY block_num ASC, log_index ASC
      LIMIT ${MAX_ROWS_PER_POLL}
    `;
    const rows = await ampQuery(sql);
    return rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      address: r.address ? `0x${r.address}` : null,
      topic0: r.topic0 ? `0x${r.topic0}` : null,
      topic1: r.topic1 ? `0x${r.topic1}` : null,
      topic2: r.topic2 ? `0x${r.topic2}` : null,
      topic3: r.topic3 ? `0x${r.topic3}` : null,
      data: `0x${r.data ?? ""}`,
    }));
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let lastBlock = 0;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", close);

      controller.enqueue(
        new TextEncoder().encode(
          `: connected from ${ip} — filter{address:${address ?? "*"},topic0:${topic0 ?? "*"}}\n\n`,
        ),
      );

      try {
        while (!closed && Date.now() - started < STREAM_MAX_MS) {
          const tipRows = await ampQuery(
            `SELECT MAX(block_num) AS tip FROM ${table("blocks")}`,
          );
          const tip = Number(tipRows[0]?.tip ?? 0);
          if (tip > 0 && lastBlock === 0) lastBlock = tip - 1; // start at "now"

          if (tip > lastBlock) {
            const rows = await logsSince(lastBlock, tip);
            for (const row of rows) {
              if (closed) break;
              controller.enqueue(sseFrame("log", row));
            }
            lastBlock = tip;
          } else {
            controller.enqueue(sseFrame("heartbeat", { tip, ts: Date.now() }));
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
        controller.enqueue(sseFrame("close", { reason: "max_duration", reconnect: true }));
      } catch (e) {
        controller.enqueue(
          sseFrame("error", { message: e instanceof Error ? e.message : String(e) }),
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
      "X-Accel-Buffering": "no",
    },
  });
}
