import { 
    closeModal, openConfirmModal, confirm,
    setConfirmBtnState
} from "../global/modal.js?v=48f449a2.795b6ab";

import { 
    selectTeamTile, closeTeamTiles, teamTileFocusout
} from "./contacts.js?v=48f449a2.795b6ab";

const teamList = document.getElementById("team-list");

/* === LOCAL FUNCTIONS === */
async function handleClick(el, e) {
    switch (el.dataset.action) {
        case "select-team-tile":
            selectTeamTile(el);
            break;

        default:
            console.warn("unknown 'click' action:", el.dataset.action)
    }
}

async function handleChange(el) {
    switch (el.dataset.changeType) {
        default:
            console.warn("unknown 'change' action:", el.dataset.changeType)
    }
}

/* === LISTENERS === */
document.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-allow-action]") && event.target.closest("[data-no-action]")) return;
    const el = event.target.closest("[data-action]");
    if (!el) {
        // click outside any tile closes the open one
        closeTeamTiles();
        return;
    }
    event.preventDefault(); // prevent page scroll on Space
    await handleClick(el, event);
});

document.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.closest("[data-allow-action]") && event.target.closest("[data-no-action]")) return;
    const el = event.target.closest("[data-action]");
    if (!el) return;
    if (el.dataset.action != "tag-input") {
        event.preventDefault();
    }
    await handleClick(el, event);
});

document.addEventListener("change", (event) => {
    const el = event.target.closest("[data-change-type]");
    if (!el) return;
    event.preventDefault(); // prevent page scroll on Space
    handleChange(el);
});


document.addEventListener("submit", (event) => {
  event.preventDefault();
});

teamList?.addEventListener("focusout", teamTileFocusout);
