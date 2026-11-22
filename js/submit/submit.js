console.log("executing:", "submit.js");

import { openErrorModal, openSuccessModal, openPublicationCharterModal } from "../global/modal.js?v=ffe0d663.3dc44e3a";
import { initEventForm, getEventFormPayload, uploadImageFile, loadProfiles, setCreatorFields } from "../global/eventform.js?v=ffe0d663.3dc44e3a";

/* === VARIABLES === */
const loading = document.getElementById("loading-screen");
// keep the spinner outside the .ready-gated content so it stays visible while loading
document.body.appendChild(loading);
const eventForm = document.getElementById("event-form");
const submitContainer = document.getElementById("submit-container");
const creatorTile = document.getElementById("creator-tile");

let user_profile = null;
let pendingEvent = null;  // validated payload awaiting charter acceptance

/* === LOCAL FUNCTIONS === */
async function initSubmitPage() {
    console.log("init /submit/ page");
    const session = await getSessionUserProfile();
    if (session?.session?.user && session?.profile) {
        showSubmit(session.session.user, session.profile);
    } else {
        showLoginWarning();
    }
}

function showLoginWarning() {
    user_profile = null;
    submitContainer.hidden = true;
    window.location.href = `../account/`
}

function showSubmit(user, profile) {
    user_profile = profile;
    
    /* configure roles */
    const basicContribText = document.querySelector(".text-basic-contributor");
    if (user_profile.role == 0) {
        basicContribText.classList.remove("hidden");
    } else {
        basicContribText.classList.add("hidden");
    }
    
    /* initialize form */
    initEventForm();
    eventForm.querySelector("#cancel-btn").hidden = true;
    eventForm.querySelector("#cancel-btn").disabled = true;

    /* creator section (super admins only) */
    creatorTile.hidden = profile.role <= 2;
    if (profile.role > 2) {
        setCreatorFields(user_profile.id, user_profile.name, user_profile.email);
        loadProfiles();
    }

    /* show page */
    submitContainer.hidden = false;
    loading.style.display = "none";
    document.documentElement.classList.add("ready");
}

/* === EXPORTED FUNCTIONS === */
export async function submitEvent() {
    /* validate the form first; the charter must be accepted before publishing */
    const new_event = getEventFormPayload();
    if (!new_event) return;

    pendingEvent = new_event;
    // openPublicationCharterModal(true);

    const publishBtn = eventForm.querySelector("#button")
    publishBtn?.setAttribute("aria-busy", "true");

    /* upload image if needed */
    const {imageUrl, error} = await uploadImageFile();
    if (error) {
        publishBtn?.setAttribute("aria-busy", "false");
        openErrorModal("Problème pendant le téléchargement de l'image");
        console.error(error);
        return;
    }

    /* super admins can publish on behalf of another account (creator tile) */
    const creator = user_profile.role > 2
        ? {
            id: eventForm.querySelector("#created_by").value || user_profile.id,
            name: eventForm.querySelector("#creator_name").value.trim() || null,
            email: eventForm.querySelector("#creator_email").value.trim() || null
        }
        : user_profile;

    /* push the event on database: one row, whatever its number of days and places */
    const payload = new_event.payload;
    payload.pending = user_profile.role == 0;
    payload.created_by = creator?.id ?? null;
    payload.creator_name = creator?.name ?? null;
    payload.creator_email = creator?.email ?? null;
    payload.image_url = imageUrl;
    payload.is_test = APP_CONFIG.DEV;
    console.log("submit event payload:", payload);

    const { error: insertError } = await window.supabaseClient.from("events").insert(payload);
    if (insertError) {
        publishBtn?.setAttribute("aria-busy", "false");
        openErrorModal("Problème de publication", insertError.message ? insertError.message : null);
        console.error(insertError);
        return;
    }

    publishBtn?.setAttribute("aria-busy", "false");
    pendingEvent = null;
    window.scrollTo(0, 0);
    eventForm.reset();
    
    const basicContributor = user_profile.role == 0;
    openSuccessModal(basicContributor
        ? "Évènement proposé et en cours de validation. Il sera publié sous 3 jours. Retour à la liste des évènements automatiquement."
        : "Évènement publié ! Retour à la liste des évènements automatiquement.");

    setTimeout(function () {
        window.location.href = "..";
    }, basicContributor ? 5000 : 3000);
    
}

/* === INITIAL LOAD === */
initSubmitPage().catch(console.error);
