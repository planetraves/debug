const pendingNotification = document.getElementById("pending-notification");
let pendingNotificationVersion = 0;

window.refreshPendingNotifications = async function () {
    if (!pendingNotification) return;
    const version = ++pendingNotificationVersion;
    pendingNotification.hidden = true;

    try {
        const { profile } = await getSessionUserProfile();
        if (!(profile?.role >= 2)) return;

        const [events, requests] = await Promise.all([
            window.supabaseClient.from("events").select("id").eq("pending", true).limit(1),
            window.supabaseClient.from("profiles").select("id").eq("official_request", true).limit(1)
        ]);

        if (version !== pendingNotificationVersion) return;
        pendingNotification.hidden = !(
            (!events.error && events.data?.length > 0) ||
            (!requests.error && requests.data?.length > 0)
        );
    } catch (error) {
        console.error("Pending notifications failed:", error);
    }
};