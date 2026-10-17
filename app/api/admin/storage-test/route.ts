import { apiError, requireAdminApi } from "@/lib/auth";
import { deleteKeys, presignGet, presignPut } from "@/lib/storage";

const KEY = "_diagnostic/test.txt";

/** Diagnostic : fournit des URL temporaires pour vérifier qu'Oracle accepte les envois du navigateur. */
export async function GET() {
  try {
    await requireAdminApi();
    return Response.json({ put: await presignPut(KEY, "text/plain"), get: await presignGet(KEY) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE() {
  try {
    await requireAdminApi();
    await deleteKeys([KEY]);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
