/** Next.js Node server startup: durable payment/job reconciliation, not a client-side effect. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRecovery } = await import("./lib/recovery");
    await startRecovery();
  }
}
