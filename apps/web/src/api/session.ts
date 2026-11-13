import { api, type Session } from "./client";
export async function bootstrapSession(storage: Storage = localStorage): Promise<Session> {
  const token = storage.getItem("nf_session_token");
  const recoveryCode = storage.getItem("nf_recovery_code");
  let session: Session | undefined;
  for (const credentials of [token ? { token } : null, recoveryCode ? { recoveryCode } : null, {}]) {
    if (credentials === null) continue;
    try { session = await api.session(credentials); break; } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || (error as { status: number }).status >= 500) throw error;
    }
  }
  if (!session) throw new Error("Unable to start guest session");
  storage.setItem("nf_session_token", session.token);
  if (session.recoveryCode) storage.setItem("nf_recovery_code", session.recoveryCode);
  return session;
}
