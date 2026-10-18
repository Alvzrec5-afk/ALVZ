import { randomBytes } from "node:crypto";
import { boardVisitor, findSharedBoard, setBoardVisitor } from "@/lib/boards";

/** Le client donne son prénom : ses cartes seront signées avec, et lui seul pourra les modifier. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const board = await findSharedBoard((await params).slug);
  if (!board) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = String(name ?? "").replace(/[:\s]+/g, " ").trim().slice(0, 40);
  if (!clean) return Response.json({ error: "Prénom manquant" }, { status: 400 });
  const current = await boardVisitor(board);
  await setBoardVisitor(board, current?.clientId ?? randomBytes(12).toString("base64url"), clean);
  return Response.json({ name: clean });
}
