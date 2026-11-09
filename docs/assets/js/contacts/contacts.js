console.log("executing:", "contacts.js");

/* === VARIABLES === */
const loading = document.getElementById("loading-screen");
// keep the spinner outside the .ready-gated content so it stays visible while loading
document.body.appendChild(loading);
const contactsContainer = document.getElementById("contacts-container");
const teamList = document.getElementById("team-list");

let user_profile = null;

/* === LOCAL FUNCTIONS === */
async function initContactsPage() {
    console.log("init /contacts/ page");

    await loadTeam();

    contactsContainer.hidden = false;
    loading.style.display = "none";
    document.documentElement.classList.add("ready");
}

function renderTeamTile(profile, index) {
    const name = escapeHtml(profile.name || "");
    const email = escapeHtml(profile.email || "");
    const roleLabel = escapeHtml(APP_CONFIG.ROLES[profile.role] || "");
    const extraLabel = profile.label ? `<span class="team-badge team-badge-extra">${escapeHtml(profile.label)}</span>` : "";
    const colorIndex = index % Object.keys(APP_CONFIG.CATEGORIES).length;
    // const colorIndex = profile.color != null? profile.color : 999

    return `
        <div class="team-tile" tabindex="0" data-action="select-team-tile" style="--team-accent: var(--category${colorIndex}); --team-accent-soft: var(--category${colorIndex}--light);">
            <span class="team-avatar material-symbols-outlined" aria-hidden="true">support_agent</span>
            <span class="team-info">
                <span class="team-name">${name}</span>
                <span class="team-badges">
                    <span class="team-badge">${roleLabel}</span>
                    ${extraLabel}
                </span>
                <span class="team-email">
                    <span class="material-symbols-outlined" aria-hidden="true">mail</span>
                    <span class="team-email-text">${email}</span>
                </span>
            </span>
            <a class="team-write-btn" href="mailto:${email}" aria-label="Écrire à ${name}" data-no-action>Écrire</a>
        </div>
    `;
}

export function closeTeamTiles(except = null) {
    teamList.querySelectorAll(".team-tile.open").forEach(tile => {
        if (tile !== except) tile.classList.remove("open");
    });
}

async function loadTeam() {
    if (!teamList) return;

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("name, email, role, label, color")
        .gte("role", 2) /* modérateurs (2) et admins (3) */
        .order("role", { ascending: false })
        .order("name", { ascending: true });

    if (error) {
        console.error("failed to load team:", error);
        teamList.innerHTML = `<div class="team-empty">Impossible de charger l'équipe pour le moment.</div>`;
        return;
    }

    if (!data || data.length === 0) {
        teamList.innerHTML = `<div class="team-empty">Aucun membre pour le moment.</div>`;
        return;
    }

    teamList.innerHTML = data.map(renderTeamTile).join("");
}


/* === EXPORTED FUNCTIONS === */
export function selectTeamTile(tile) {
    closeTeamTiles(tile);
    tile.classList.add("open");
}

export function teamTileFocusout(e) {
    const tile = e.target.closest(".team-tile");
    if (tile && !tile.contains(e.relatedTarget)) tile.classList.remove("open");
}

/* === MAIN === */
initContactsPage().catch(console.error);

