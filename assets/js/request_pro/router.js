import {
    sendRequestPro, goBack, setSendBtnState, onFieldEdited
} from "./request_pro.js?v=7118b96a.b3ecfe0";

import {
    closeModal
} from "../global/modal.js?v=7118b96a.b3ecfe0";

async function handleClick(el) {
    switch (el.dataset.action) {
        case "send-request":
            await sendRequestPro();
            break;

        case "go-back":
        case "cancel-edit":
            goBack();
            break;

        case "close-modal":
            closeModal(el);
            break;

        default:
            console.warn("unknown 'click' action:", el.dataset.action)
    }
}

async function handleInput(el) {
    switch (el.dataset.inputType) {
        case "request-details":
            setSendBtnState(el);
            break;

        default:
            console.warn("unknown 'input' type:", el.dataset.inputType)
    }
}

/* === LISTENERS === */
document.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-allow-action]") && event.target.closest("[data-no-action]")) return;
    const el = event.target.closest("[data-action]");
    if (!el) return;
    event.preventDefault(); // prevent page scroll on Space
    await handleClick(el);
});

document.addEventListener("input", (event) => {
    onFieldEdited(event.target); // clear inline validation error of the edited field
    const el = event.target.closest("[data-input-type]");
    if (!el) return;
    event.preventDefault(); // prevent page scroll on Space
    handleInput(el);
});

document.addEventListener("change", (event) => {
    onFieldEdited(event.target); // clear inline validation error of the edited field
});

window.addEventListener("load", () => {
    document.documentElement.classList.add("ready");
});

