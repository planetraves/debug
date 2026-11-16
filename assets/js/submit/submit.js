console.log("executing:", "submit.js");

import { openErrorModal, openSuccessModal, openPublicationCharterModal } from "../global/modal.js?v=28e10952.99d9fff";
import { initEventForm, getEventFormPayload, uploadImageFile, loadProfiles, setCreatorFields } from "../global/eventform.js?v=28e10952.99d9fff";

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
    eventForm.querySelector("#end_date_container").hidden = false;
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

    /* push events on database */
    for (let day = 0; day < new_event.nb_days; day++) {
        var payload = new_event.payload;
        payload.event_date = formatDateStr(addDays(eventForm.querySelector("#event_date").value + "T00:00:00", day))
        payload.pending = user_profile.role == 0
        payload.created_by = creator?.id ?? null
        payload.creator_name = creator?.name ?? null;
        payload.creator_email = creator?.email ?? null;
        payload.image_url = imageUrl
        payload.is_test = APP_CONFIG.DEV
        console.log("submit event payload:", payload)

        const { data: event, error } = await window.supabaseClient.from("events").insert(payload);
        if (error) {
            publishBtn?.setAttribute("aria-busy", "false");
            if ((new_event.nb_days > 1) && (day > 0)) {
                openErrorModal(`Problème de publication (jour ${day+1})\nCependant les premiers jours de l'évènement ont sans doute été publiés`, error.message ? error.message : null);
            } else {
                openErrorModal("Problème de publication", error.message ? error.message : null);
            }
            console.error(error);
            return;
        }
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
