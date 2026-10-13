console.log("executing:", "request_pro.js");

import {openErrorModal, openSuccessModal} from "../global/modal.js?v=dev";
import {clearFieldError, markInvalidFields, focusField} from "../global/checkFieldsValidity.js?v=dev";

/* === VARIABLES === */
const requestContainer = document.getElementById("request-container");
const loading = document.getElementById("loading-screen");
const backBtn = document.getElementById("back-btn");
const requestForm = document.getElementById("request-form");
const requestCharCount = document.getElementById("request-char-count");
const detailsArea = document.getElementById("details-input");

let user_profile = null;

/* === LOCAL FUNCTIONS === */
async function initRequestProPage() {
    console.log("init /request_pro/ page");

    const session = await getSessionUserProfile();
    if (session?.session?.user && session?.profile) {
        user_profile = session.profile;
        backBtn.classList.remove("hidden");
        loading.style.display = "none";
        requestContainer.hidden = false;
    } else {
        showLoginWarning();
    }
}

/* === EXPORTED FUNCTIONS === */
export function goBack(){
    const currentPage = new URL(window.location.href);
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const referrerIsCurrentPage = referrer
        && referrer.origin === currentPage.origin
        && referrer.pathname === currentPage.pathname;

    window.location.href = referrerIsCurrentPage || !referrer ? ".." : document.referrer;
}

export function setSendBtnState(target) {
    requestCharCount.innerText = target.value.length;
}

export function onFieldEdited(el) {
    if (el.classList?.contains("field-invalid")) clearFieldError(el);
}

export async function sendRequestPro() {

    /* reset form custom validity */
    detailsArea.setCustomValidity("");

    if (!user_profile) return;

    /* check detail text area */
    if (detailsArea.value.length < 100) {
        detailsArea.setCustomValidity(`Le texte doit contenir au moins 100 caractères`);
    }

    /* report form validity */
    const firstInvalid = markInvalidFields(requestForm, false);
    if (firstInvalid) {
        openErrorModal("La description doit contenir au moins 100 caractères.");
        focusField(firstInvalid)
        return;
    };
    
    // SUPABASE UPDATE PROFILES
    // console.log("Official role request for user", user_profile);
    // const { error } = await window.supabaseClient
    //     .from("profiles")
    //     .update({
    //         official_request: true,
    //         official_request_details: officialRequestInput.value
    //     })
    //     .eq("id", user_profile.id); // auth.uid()

    // if (error) {
    //     openErrorModal("Un problème est survenu");
    //     console.error(error);
    //     return;
    // }

    openSuccessModal("Requête envoyèe ! Vous allez être redirigé automatiquement.");
    
    // setTimeout(() => {
    //     window.location.href = `..`;
    // }, 3000);
}

/* === INITIAL LOAD === */
initRequestProPage().catch(console.error);