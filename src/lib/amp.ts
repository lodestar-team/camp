import { env } from "./env";
import { ApiError } from "./errors";

type Row = Record<string, unknown>;

type AmpErrorBody = { error_code: string; error_message: string };

export async function ampQuery(sql: string, signal?: AbortSignal): Promise<Row[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AMP_QUERY_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  let res: Response;
  if (process.env.AMP_DEBUG_SQL) console.error("AMP SQL:", JSON.stringify(sql));
  try {
    res = await fetch(`${env.AMP_ORIGIN}/`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Amp-Token": env.AMP_TOKEN,
      },
      body: sql,
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(
        "query_timeout",
        504,
        `query exceeded ${env.AMP_QUERY_TIMEOUT_MS}ms`,
        "narrow the block range or address filter",
      );
    }
    throw new ApiError("upstream_unavailable", 502, "ampd unreachable");
  }
  clearTimeout(timeout);

  const text = await res.text();
  if (!res.ok) {
    let parsed: AmpErrorBody | null = null;
    try { parsed = JSON.parse(text); } catch {}
    if (parsed?.error_message?.includes("not found")) {
      throw new ApiError("bad_request", 400, parsed.error_message);
    }
    throw new ApiError(
      "upstream_unavailable",
      502,
      parsed?.error_message ?? text.slice(0, 200),
    );
  }

  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Row);
}

export function table(name: "blocks" | "transactions" | "logs"): string {
  return `"${env.AMP_DATASET}".${name}`;
}

export function hexLiteral(hex: string): string {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new ApiError("bad_request", 400, `invalid hex: ${hex}`);
  }
  return `X'${stripped.toLowerCase()}'`;
}

export function hexCol(col: string): string {
  return `encode(arrow_cast(${col}, 'Binary'), 'hex')`;
}

export async function fetchTip(): Promise<number> {
  const rows = await ampQuery(
    `SELECT MAX(block_num) AS tip FROM ${table("blocks")}`,
  );
  return Number(rows[0]?.tip ?? 0);
}
