/**
 * Works out which Supabase pooler endpoint and username format this project
 * answers on, WITHOUT using the real password.
 *
 * The trick is that the two failure modes are distinguishable:
 *   "Tenant or user not found"        -> wrong host, or unknown username
 *   "password authentication failed"  -> host and username are RIGHT
 * so a deliberately wrong password is enough to identify the right endpoint,
 * and nothing secret ever appears in the logs.
 */
import postgres from "postgres";

const REF = process.env.SUPABASE_REF;
const REGION = process.env.SUPABASE_REGION ?? "ap-south-1";
if (!REF) throw new Error("SUPABASE_REF is required");

const hosts = [`aws-0-${REGION}.pooler.supabase.com`, `aws-1-${REGION}.pooler.supabase.com`];
const users = [`postgres.${REF}`, `jobrail_app.${REF}`];
const ports = [6543, 5432];

for (const host of hosts) {
  for (const port of ports) {
    for (const user of users) {
      const sql = postgres({
        host, port, user,
        password: "definitely-not-the-real-password",
        database: "postgres",
        ssl: "require",
        max: 1,
        connect_timeout: 10,
      });
      let verdict;
      try {
        await sql`select 1`;
        verdict = "CONNECTED (unexpected)";
      } catch (err) {
        const msg = String(err.message ?? err);
        verdict = /password authentication failed|invalid password/i.test(msg)
          ? "*** ENDPOINT VALID (rejected the fake password) ***"
          : msg.slice(0, 90);
      } finally {
        await sql.end({ timeout: 5 }).catch(() => {});
      }
      console.log(`${host}:${port}  ${user.padEnd(34)}  ${verdict}`);
    }
  }
}
