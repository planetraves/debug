console.log("executing:", "logger.js");

// Persistent debug log that survives page reloads (PC debug only).
// Stored in localStorage so it stays available after window.location.reload().
// After a reload, type showLog() in the console to print it, clearLog() to wipe it.
const _LOG_KEY = "debug_log";

function fileLog(text) {
    if (typeof APP_CONFIG === "undefined" || !APP_CONFIG.DEV) return; // debug only

    const line = `[${new Date().toISOString()}] ${text}`;
    console.log(line);
    try {
        const prev = localStorage.getItem(_LOG_KEY) || "";
        localStorage.setItem(_LOG_KEY, `${prev}${line}\n`);
    } catch (err) {
        console.warn("fileLog failed:", err);
    }
}

function showLog() {
    console.log(localStorage.getItem(_LOG_KEY) || "(log empty)");
}

function clearLog() {
    localStorage.removeItem(_LOG_KEY);
}
