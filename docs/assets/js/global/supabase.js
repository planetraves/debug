console.log("executing:", document.currentScript?.src);

window.supabaseClient = supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
);

console.log("supabase client initialized");

// A stale/expired token makes requests fall over ("Invalid Refresh Token"); clear it
// so the client falls back to the anon key.
async function ensureValidSession() {
    try {
        const { error } = await window.supabaseClient.auth.getSession();
        if (error) {
            console.warn("clearing invalid session:", error.message);
            await window.supabaseClient.auth.signOut({ scope: "local" });
        }
    } catch (err) {
        console.warn("session check failed, clearing:", err);
        await window.supabaseClient.auth.signOut({ scope: "local" });
    }
}

// Cookieless visit tracking: one row per (visitor, month) so repeated views by the
// same device in a month are not counted twice. Skips the DB call if already logged
// this month on this device.
// Plain insert on purpose: visitors may insert into "visits" but not read it (RLS), and
// both .select() and upsert (INSERT ... ON CONFLICT) need read access to the row.
async function trackVisit() {
    try {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        console.log("trackVisit: period", period, "stored guard", localStorage.getItem("visit_period"));

        if (localStorage.getItem("visit_period") === period) {
            console.log("trackVisit: skipped (already logged this month on this device)");
            return;
        }

        let visitorId = localStorage.getItem("visitor_id");
        if (!visitorId) {
            visitorId = crypto.randomUUID();
            localStorage.setItem("visitor_id", visitorId);
        }

        console.log("trackVisit: inserting", { visitorId, period });
        const { error } = await window.supabaseClient
            .from("visits")
            .insert({ visitor_id: visitorId, period });

        console.log("trackVisit: result", { error });

        // 23505 (unique violation): this device is already counted for this month
        if (error && error.code !== "23505") {
            console.warn("trackVisit insert failed:", error);
            return; // don't mark done, so it retries next load
        }

        localStorage.setItem("visit_period", period);
    } catch (err) {
        console.warn("trackVisit failed:", err);
    }
}

ensureValidSession().then(trackVisit);
