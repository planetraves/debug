console.log("executing:", "edit_event.js");

import { openErrorModal, openSuccessModal } from "../global/modal.js?v=5c159498.7aed374";
import { initEventForm, getEventFormPayload, uploadImageFile } from "../global/eventform.js?v=5c159498.7aed374";

/* === VARIABLES === */
const hash = window.location.hash.substring(1);
const previousPage = document.referrer;
const params = new URLSearchParams(hash);
const eventId = params.get("id");

const notice = document.getElementById("notice-tile");
const noticeTitle = notice.querySelector("#title");
const noticeText = notice.querySelector("#text");

const loading = document.getElementById("loading-screen");
const backBtn = document.getElementById("back-btn");
const form = document.getElementById("event-form");
const submitContainer = document.getElementById("submit-container");
const creatorTile = document.getElementById("creator-tile");

let user_profile = null;
let PROFILES = [];

/* === LOCAL FUNCTIONS === */
async function initEditEventPage() {
    console.log("init /edit_event/ page");
    console.log("eventId:", eventId);

    submitContainer.hidden = true;
    const session = await getSessionUserProfile();
    if (session?.session?.user && session?.profile) {
        // get event
         const { data, error } = await window.supabaseClient
            .from("future_events")
            .select("*")
            .eq("id", eventId).single()

        if (error) {
            console.log("Error:", error);
            openErrorModal("ERREUR survenue durant le chargement de l'évènement");
            return;
        }
        showEdit(session.session.user, session.profile, data);
    } else {
        showLoginWarning();
    }
}

function showLoginWarning() {
    user_profile = null;
    submitContainer.hidden = true;
    window.location.href = `../account/`;
}

async function loadProfiles() {
    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, name, email");

    if (error) {
        console.error(error);
        openErrorModal("Erreur survenue durant le chargement des utilisateur·rice·s");
        return;
    }
    PROFILES = data ?? [];
}

function setCreatorFields(id, name, email) {
    form.querySelector("#created_by").value = id ?? "";
    form.querySelector("#creator_name").value = name ?? "";
    form.querySelector("#creator_email").value = email ?? "";
}

function showEdit(user, profile, event) {
    user_profile = profile;
    
    /* initialize form */
    initEventForm(event);
    form.querySelector("#end_date_container").hidden = true;
    form.querySelector("#cancel-btn").hidden = false;
    form.querySelector("#cancel-btn").disabled = false;

    document.querySelector(".text-basic-contributor").classList.toggle("hidden", profile.role != 0);

    /* creator section (super admins only) */
    creatorTile.hidden = profile.role <= 2;
    if (profile.role > 2) {
        setCreatorFields(event.created_by, event.creator_name, event.creator_email);
        loadProfiles();
    }

    /* show page */
    noticeTitle.innerText = "Editer votre évènement";
    noticeText.innerHTML = `Vous souhaitez ici éditer un évènement que vous avez créé le ${formatDateForUI(event.created_at)}
        <br><br>
        Pour plus d'information sur les critères de publication, nous vous invitons à lire la <strong>charte de publication</strong>. 
        Elle vise à garder l'agenda utile, culturel et agréable pour tout le monde. `;
    submitContainer.hidden = false;
    backBtn.classList.remove("hidden");
    loading.style.display = "none";
}

/* === EXPORTED FUNCTIONS === */
export function searchCreator(input) {
    const suggestions = input.parentElement.querySelector(".suggestions");
    const value = input.value.toLowerCase().trim();
    suggestions.innerHTML = "";

    const matches = value.length < 2 ? [] : PROFILES.filter(p =>
        (p.email ?? "").toLowerCase().includes(value) || (p.name ?? "").toLowerCase().includes(value)
    ).slice(0, 5);

    if (matches.length === 0) {
        input.classList.remove("looking");
        suggestions.classList.add("hidden");
        return;
    }

    for (const p of matches) {
        const span = document.createElement("span");
        span.textContent = `${p.name ?? "-"} (${p.email ?? "-"})`;
        span.addEventListener("click", () => {
            setCreatorFields(p.id, p.name, p.email);
            input.value = "";
            input.classList.remove("looking");
            suggestions.classList.add("hidden");
        });
        suggestions.appendChild(span);
    }

    input.classList.add("looking");
    suggestions.classList.remove("hidden");
}

export function goBack(){
    const currentPage = new URL(window.location.href);
    const referrer = previousPage ? new URL(previousPage) : null;
    const referrerIsCurrentPage = referrer
        && referrer.origin === currentPage.origin
        && referrer.pathname === currentPage.pathname;
    const backPage = referrerIsCurrentPage || !referrer ? ".." : previousPage;
    const backUrl = !previousPage || !eventId ? ".." : `${backPage}#id=${eventId}&type=myevent`;

    console.log("Going back to previous page:", backUrl);
    window.location.href = backUrl;
}

export async function editEvent() {
    button.setAttribute("aria-busy", "true");

    /* get form payload */
    const new_event = getEventFormPayload();
    if (!new_event) {
        button.setAttribute("aria-busy", "false");
        return;
    };

    /* upload image if needed */
    const {imageUrl, error: uploadError} = await uploadImageFile();
    if (uploadError) {
        button.setAttribute("aria-busy", "false");
        openErrorModal("Problème pendant le téléchargement de l'image");
        console.error(uploadError);
        return;
    }

    var payload = new_event.payload;
    payload.event_date = form.querySelector("#event_date").value;
    payload.pending = user_profile.role == 0;
    if (user_profile.role > 2) {
        const createdBy = form.querySelector("#created_by").value;
        if (createdBy) payload.created_by = createdBy;
        payload.creator_name = form.querySelector("#creator_name").value.trim() || null;
        payload.creator_email = form.querySelector("#creator_email").value.trim() || null;
    }
    payload.image_url = imageUrl;
    console.log("submit event payload (for edit):", payload);

    const { error } = await window.supabaseClient
        .from("events")
        .update(payload)
        .eq("id", eventId);

    if (error) {
        button.setAttribute("aria-busy", "false");
        openErrorModal("Problème de mise à jour");
        console.error(error);
        return;
    }

    button.setAttribute("aria-busy", "false");
    window.scrollTo(0, 0);
    form.reset();
    openSuccessModal("Évènement mis à jour ! Retour à la liste des évènements automatiquement.");

    setTimeout(function () {
        window.location.href = "..";
    }, 3000);
}

/* === INITIAL LOAD === */
initEditEventPage().catch(console.error);