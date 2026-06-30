import type { NextRequest } from "next/server";
import { getAudit } from "@/lib/orchestrator";

/** GET /api/audits/:id — fetch a previously-generated audit. */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const audit = await getAudit(id);

  if (!audit) {
    return Response.json(
      { error: { code: "not_found", message: "Audit not found or expired." } },
      { status: 404 },
    );
  }
  return Response.json(audit);
}
