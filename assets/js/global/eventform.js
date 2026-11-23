console.log("executing:", "eventform.js");

import { openErrorModal } from "./modal.js?v=dd3474ef.56eae793";
import { tagInput, userTags, clearTags, addTag } from "./tags.js?v=dd3474ef.56eae793";
import { clearFieldError, markInvalidFields, focusField } from "./checkFieldsValidity.js?v=dd3474ef.56eae793";
// import { parsePhoneNumber, AsYouType } from 'libphonenumber-js'

/* === VARIABLES === */
const today = startOfDay(new Date());
const MAX_EVENT_DAYS = 14; // maximum duration including the start date (same limit in the database)

const eventForm = document.getElementById("event-form");
const categoryChoices = document.getElementById("category-choices");
const parentalGuideList = document.getElementById("pg");
const priceChoiceList = document.getElementById("price-choice");
const minPrice = document.getElementById("min_price");
const maxPrice = document.getElementById("max_price");
const eventImage = document.getElementById("event-image");
const deleteImageBtn = document.getElementById("remove-image-btn");
const eventDateInput = document.getElementById("event_date");
const endDateInput = document.getElementById("end_date");
const startTimeInput = document.getElementById("event_start_time");
const startTimeContainer = document.getElementById("start_time_container");
const placesList = document.getElementById("places-list");
const programmeContainer = document.getElementById("programme-container");
const programmeList = document.getElementById("programme-list");
const programmeToggle = document.getElementById("programme-toggle");
const programmeBody = document.getElementById("programme-body");
const clearEndDateBtn = document.getElementById("clear-end-date");

let currentImageUrl = null;
let imageToUpload = null;
let selectedCategories = new Set();
let PROFILES = [];  // accounts searchable in the creator tile (super admins only)

/* places and programme: each place block has a stable key (kept when another place is removed);
   programme maps each day of the date range to { removed, entries: [{ place: <key>, time: "HH:MM" | "" }] } */
let placeSeq = 0;
let programme = new Map();
let initialEventDate = null;  // edit mode: saved first day, may be in the past for an event in progress

/* === LOCAL FUNCTIONS === */
async function resizeImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = () => {
            img.src = reader.result;
            showImagePreview(file.name, img.src);
        };

        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement("canvas");

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => resolve(blob),
                "image/jpeg",
                quality
            );
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showImagePreview(image_name, image_src) {
    deleteImageBtn.hidden = false;
    eventForm.querySelector(".event-image-wrapper").hidden = false;
    eventForm.querySelector("#event-thumbnail").src = image_src;
    eventForm.querySelector("#file-name").textContent = image_name;
}

function renderCategoryChoices() {
    categoryChoices.innerHTML = "";
    Object.keys(APP_CONFIG.CATEGORIES).forEach(key => {
        const cat = APP_CONFIG.CATEGORIES[key];
        const isSelected = selectedCategories.has(key);
        categoryChoices.innerHTML += `
            <button type="button" class="category-chip ${isSelected ? "selected" : ""}" data-action="toggle-category" data-category="${key}" style="--chip-color: ${categoryColor(key)};" aria-pressed="${isSelected}">
                <span class="material-symbols-outlined">${cat.icon}</span>
                ${cat.label}
            </button>`;
    });
}

/* === PLACES === */
function placeBlocks() {
    return [...placesList.querySelectorAll(".place-block")];
}

function placeKeys() {
    return placeBlocks().map(block => block.dataset.placeKey);
}

function placeLabel(key, index) {
    const name = placesList.querySelector(`[data-place-key="${key}"] .place-name`)?.value.trim();
    return name || `Lieu ${index + 1}`;
}

function renderPlaceBlock(key) {
    return `
        <fieldset class="place-block" data-place-key="${key}" data-address-group>
            <div class="place-header">
                <span class="place-title"></span>
                <button type="button" class="icon-btn remove-place-btn" data-action="remove-place" aria-label="Retirer ce lieu" title="Retirer ce lieu">
                    <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
            </div>
            <input type="text" id="place-${key}-name" class="place-name" placeholder="Nom du lieu *" data-input-type="place-name" required>
            <div class="address-autocomplete">
                <input type="text" id="place-${key}-address" class="search-address" placeholder="Numéro et rue *" autocomplete="off" data-input-type="address-search" required>
                <div class="address-suggestions hidden"></div>
            </div>
            <input type="text" id="place-${key}-address-2" class="place-address-2" placeholder="Complément d'adresse">
            <input type="text" id="place-${key}-code" class="place-code" inputmode="numeric" maxlength="5" placeholder="Code postal *" required>
            <input type="text" id="place-${key}-town" class="place-town" placeholder="Ville *" required>
        </fieldset>`;
}

/* add a place block, filled with `location` ({name, address, address_2, code, town}) if given */
function addPlace(location = null) {
    const key = String(++placeSeq);
    placesList.insertAdjacentHTML("beforeend", renderPlaceBlock(key));
    const block = placesList.querySelector(`[data-place-key="${key}"]`);
    if (location) {
        block.querySelector(".place-name").value = location.name ?? "";
        block.querySelector(".search-address").value = location.address ?? "";
        block.querySelector(".place-address-2").value = location.address_2 ?? "";
        block.querySelector(".place-code").value = location.code ?? "";
        block.querySelector(".place-town").value = location.town ?? "";
    }
    refreshPlaces();
    return block;
}

function refreshPlaces() {
    const blocks = placeBlocks();
    blocks.forEach((block, i) => {
        block.querySelector(".place-title").textContent = `Lieu ${i + 1}`;
        block.querySelector(".remove-place-btn").hidden = blocks.length <= 1;
    });
    refreshProgramme();
}

/* === PROGRAMME === */
function rangeDates() {
    const start = eventDateInput.value;
    if (!start) return [];
    let nbDays = validateEndDate();
    if (nbDays < 1 || nbDays > MAX_EVENT_DAYS) nbDays = 1;  // invalid end date: the error shows on the field
    const first = new Date(start + "T00:00:00");
    return Array.from({ length: nbDays }, (_, i) => formatDateStr(addDays(first, i)));
}

/* copy the times and places typed in the programme into its state */
function readProgrammeFromDom() {
    programmeList.querySelectorAll(".programme-day").forEach(dayEl => {
        const day = programme.get(dayEl.dataset.date);
        if (!day || day.removed) return;
        dayEl.querySelectorAll(".programme-entry").forEach((entryEl, i) => {
            const entry = day.entries[i];
            if (!entry) return;
            entry.time = entryEl.querySelector('input[type="time"]').value;
            const select = entryEl.querySelector("select");
            if (select) entry.place = select.value;
        });
    });
}

/* time given to new days: the first time of the programme, else the simple form's time */
function defaultTime() {
    for (const day of programme.values()) {
        if (!day.removed && day.entries[0]?.time) return day.entries[0].time;
    }
    return startTimeInput.value;
}

function entriesCount() {
    return [...programme.values()].reduce((n, day) => n + day.entries.length, 0);
}


function renderProgramme() {
    const keys = placeKeys();
    const severalPlaces = keys.length > 1;
    const activeDays = [...programme.values()].filter(day => !day.removed).length;

    programmeList.innerHTML = [...programme.entries()].map(([date, day]) => {
        const label = formatShortDate(date);
        const dayLabel = label.charAt(0).toUpperCase() + label.slice(1);
        // the last remaining day can't be removed
        const canToggle = programme.size > 1 && (day.removed || activeDays > 1);
        const canAddEntry = !day.removed && severalPlaces && day.entries.length < keys.length;

        const entriesHtml = day.removed
            ? `<small class="programme-removed">Pas d'évènement ce jour</small>`
            : day.entries.map((entry, i) => `
                <div class="programme-entry">
                    <input type="time" id="programme-${date}-${i}-time" value="${entry.time}" aria-label="Heure de début, ${dayLabel}">
                    ${severalPlaces
                        ? `<select id="programme-${date}-${i}-place" aria-label="Lieu, ${dayLabel}">
                            ${keys.map((key, k) => `<option value="${key}" ${key === entry.place ? "selected" : ""}>${escapeHtml(placeLabel(key, k))}</option>`).join("")}
                           </select>`
                        : ""}
                    ${day.entries.length > 1
                        ? `<button type="button" class="icon-btn" data-action="remove-programme-entry" data-index="${i}" aria-label="Retirer ce lieu ce jour" title="Retirer ce lieu ce jour">
                            <span class="material-symbols-outlined" aria-hidden="true">close</span>
                           </button>`
                        : ""}
                </div>`).join("");

        return `
            <div class="programme-day ${day.removed ? "removed" : ""}" data-date="${date}">
                <div class="programme-day-header">
                    <strong class="programme-day-label">${dayLabel}</strong>
                    ${canToggle
                        ? `<button type="button" class="icon-btn" data-action="toggle-programme-day" aria-label="${day.removed ? "Rétablir" : "Retirer"} ce jour" title="${day.removed ? "Rétablir" : "Retirer"} ce jour">
                            <span class="material-symbols-outlined" aria-hidden="true">${day.removed ? "undo" : "event_busy"}</span>
                           </button>`
                        : ""}
                </div>
                ${entriesHtml}
                ${canAddEntry
                    ? `<button type="button" class="add-btn small" data-action="add-programme-entry">
                        <span class="material-symbols-outlined" aria-hidden="true">add</span>
                        Autre lieu ce jour
                       </button>`
                    : ""}
            </div>`;
    }).join("");
}

function programmeDay(el) {
    return programme.get(el.closest(".programme-day")?.dataset.date);
}

/* === EXPORTED FUNCTIONS === */
/* restrict the end date picker to the [event_date+1, event_date+MAX_EVENT_DAYS-1] range */
export function updateEndDateBounds() {
    endDateInput.setCustomValidity("");
    clearFieldError(endDateInput);
    if (!eventDateInput.value) {
        endDateInput.disabled = true;
        endDateInput.value = "";
        endDateInput.removeAttribute("min");
        endDateInput.removeAttribute("max");
        return;
    }
    endDateInput.disabled = false;
    const start = new Date(eventDateInput.value + "T00:00:00");
    endDateInput.min = formatDateStr(addDays(start, 1));
    endDateInput.max = formatDateStr(addDays(start, MAX_EVENT_DAYS - 1));
    if (endDateInput.value && (endDateInput.value < endDateInput.min || endDateInput.value > endDateInput.max)) {
        endDateInput.value = "";
    }
}

export function validateEndDate() {
    endDateInput.setCustomValidity("");
    if (!eventDateInput.value || !endDateInput.value || endDateInput.disabled)
    {
        clearEndDateBtn.hidden = true;
        return 1;
    }
    clearEndDateBtn.hidden = false;
    const nbDays = Math.round((new Date(endDateInput.value + "T00:00:00") - new Date(eventDateInput.value + "T00:00:00")) / 86400000) + 1;
    if (nbDays <= 1) {
        endDateInput.setCustomValidity("La date de fin doit être à strictement supérieure à la date de début");
    } else if (nbDays > MAX_EVENT_DAYS) {
        endDateInput.setCustomValidity(`Un évènement ne peut pas durer plus de ${MAX_EVENT_DAYS} jours`);
    }
    return nbDays;
}

export function onAddPlace() {
    const block = addPlace();
    // one-day event: a new place is most likely another place the same day
    if (programme.size === 1) {
        const day = [...programme.values()][0];
        day.entries.push({ place: block.dataset.placeKey, time: defaultTime() });
        renderProgramme();
    }
    block.querySelector(".place-name").focus();
}

export function removePlace(btn) {
    const block = btn.closest(".place-block");
    if (!block || placeBlocks().length <= 1) return;
    readProgrammeFromDom();
    block.remove();
    refreshPlaces();  // days only using this place fall back to the first place
}

/* rebuild the programme for the current dates and places; it is only shown for several days or places */
export function refreshProgramme() {
    const wasShown = !programmeContainer.hidden;
    console.log("wasShown:", wasShown);
    if (wasShown) {
        readProgrammeFromDom();
    } else if (entriesCount() <= 1) {
        // simple form (one day, one place): its time is the time input
        programme.forEach(day => day.entries.forEach(e => e.time = startTimeInput.value));
    }

    const dates = rangeDates();
    const keys = placeKeys();
    const time = defaultTime();
    const next = new Map();
    dates.forEach(date => {
        const day = programme.get(date) ?? { removed: false, entries: [] };
        day.entries = day.entries.filter(e => keys.includes(e.place));
        if (day.entries.length === 0) day.entries.push({ place: keys[0], time });
        next.set(date, day);
    });
    if (dates.length === 1) next.get(dates[0]).removed = false;
    programme = next;

    const shown = dates.length > 1;
    if (wasShown && !shown && dates.length) {
        startTimeInput.value = programme.get(dates[0]).entries[0].time;
    }
    // Close when first displayed or when returning to a simple event.
    // Keep the user's open/closed choice during programme updates.
    console.log("shown:", shown);
    if (!wasShown) toggleProgramme(false);
    programmeContainer.hidden = !shown;
    startTimeContainer.hidden = shown;
    if (shown) renderProgramme();
}

/* keep the place names shown in the programme up to date */
export function onPlaceNameEdited() {
    if (programmeContainer.hidden) return;
    readProgrammeFromDom();
    renderProgramme();
}

export function toggleProgrammeDay(btn) {
    readProgrammeFromDom();
    const day = programmeDay(btn);
    if (!day) return;
    day.removed = !day.removed;
    renderProgramme();
}

export function addProgrammeEntry(btn) {
    readProgrammeFromDom();
    const day = programmeDay(btn);
    if (!day) return;
    const used = new Set(day.entries.map(e => e.place));
    const free = placeKeys().find(key => !used.has(key));
    if (!free) return;
    day.entries.push({ place: free, time: day.entries[0]?.time ?? "" });
    renderProgramme();
}

export function removeProgrammeEntry(btn) {
    readProgrammeFromDom();
    const day = programmeDay(btn);
    if (!day || day.entries.length <= 1) return;
    day.entries.splice(Number(btn.dataset.index), 1);
    renderProgramme();
}

export function toggleProgramme(expand=null) {
    const isExpanded = (expand != null) ? !expand : (programmeToggle.getAttribute("aria-expanded") === "true");
    programmeToggle.setAttribute("aria-expanded", String(!isExpanded));
    programmeBody.hidden = isExpanded;
}

export function onFieldEdited(el) {
    if (el.classList?.contains("field-invalid")) clearFieldError(el);
}

export function toggleCategory(el) {
    const key = el.dataset.category;
    if (selectedCategories.has(key)) {
        selectedCategories.delete(key);
        el.classList.remove("selected");
        el.setAttribute("aria-pressed", "false");
    } else {
        selectedCategories.add(key);
        el.classList.add("selected");
        el.setAttribute("aria-pressed", "true");
    }
    console.log("selectedCategories:", selectedCategories);
}

export function clearEndDate() {
    if (endDateInput.disabled) return;

    endDateInput.value = "";
    endDateInput.setCustomValidity("");
    clearFieldError(endDateInput);
    refreshProgramme();
    clearEndDateBtn.hidden = true;
    endDateInput.focus();
}

export function initEventForm(eventData=null) {
    eventForm.reset()
    eventForm.querySelectorAll(".field-invalid").forEach(clearFieldError);
    currentImageUrl = null;
    imageToUpload = null;

    /* Configure select lists  */
    configureSelectList(APP_CONFIG.PRICE_CHOICES, priceChoiceList, 0);

    /* init category choices */
    selectedCategories = new Set();
    renderCategoryChoices();

    /* init userTags */
    clearTags();

    /* places and programme */
    placesList.innerHTML = "";
    programme = new Map();
    programmeContainer.hidden = true;
    toggleProgramme(false);
    startTimeContainer.hidden = false;
    initialEventDate = null;

    updateEndDateBounds();

    if (!eventData) {
        addPlace();
        return;
    }

    /* init form with data */
    eventForm.querySelector("#title").value = eventData.title;
    eventLocations(eventData).forEach(location => addPlace(location));
    if (eventData.long_description) eventForm.querySelector("#long_description").value = eventData.long_description;
    eventCategoryIds(eventData).forEach(id => selectedCategories.add(String(id)));
    renderCategoryChoices();
    eventForm.querySelector("#min_age").value = eventData.min_age;
    eventForm.querySelector("#max_age").value = eventData.max_age;

    eventDateInput.value = eventData.event_date;
    initialEventDate = eventData.event_date;
    updateEndDateBounds();
    const endDate = eventEndDate(eventData);
    if (endDate > eventData.event_date) endDateInput.value = endDate;
    // every day between the first and last day: a day without entry was removed by the creator
    const keys = placeKeys();
    rangeDates().forEach(date => {
        const entries = eventEntriesOn(eventData, date).map(e => ({ place: keys[e.loc] ?? keys[0], time: e.time ?? "" }));
        programme.set(date, entries.length
            ? { removed: false, entries }
            : { removed: true, entries: [{ place: keys[0], time: "" }] });
    });
    startTimeInput.value = eventSchedule(eventData)[0]?.time ?? "";
    refreshProgramme();

    if (eventData.tags) eventData.tags.forEach(t => addTag(t));
    if (eventData.phone) eventForm.querySelector("#phone").value = eventData.phone;
    if (eventData.email) eventForm.querySelector("#email").value = eventData.email;
    if (eventData.site_url) eventForm.querySelector("#site_url").value = eventData.site_url;
    if (eventData.to_eat) eventForm.querySelector('input[name="to_eat"]').checked = eventData.to_eat;
    if (eventData.to_drink) eventForm.querySelector('input[name="to_drink"]').checked = eventData.to_drink;
    priceChoiceList.value = eventData.price;
    if (eventData.price == 2) {
        if (eventData.max_price && (eventData.max_price > 0)) {
            eventForm.querySelector('#max_price').value = eventData.max_price;
            if (eventData.min_price && (eventData.min_price > 0)) eventForm.querySelector('#min_price').value = eventData.min_price;
        }
    }
    priceChoiceList.dispatchEvent(new Event("change", { bubbles: true }));

    if (eventData.image_url) {
        currentImageUrl = eventData.image_url;
        const fileName = currentImageUrl.split("/").pop();
        showImagePreview(fileName, currentImageUrl);
    }
}

export function priceChanged(target) {
    if (target.value == 2) {
        minPrice.disabled = false;
        maxPrice.disabled = false;
    }
    else
    {
        minPrice.disabled = true;
        minPrice.value = "0.00";
        maxPrice.disabled = true;
        maxPrice.value = "0.00";
    }
}

export async function handleImageChoice(file) {
    if (file.size > 10_000_000) {
        button.setAttribute("aria-busy", "false");
        openErrorModal("Image trop lourde (10Mo maximum");
        eventImage.value = "";
        return;
    }
    imageToUpload = await resizeImage(file);
}

export async function uploadImageFile() {
    /* check image has changed */
    if (imageToUpload) {
        console.log("upload image");
        const fileName = `event-${crypto.randomUUID()}.jpg`;
        const storage = window.supabaseClient.storage.from("event-images");
        const { data, error } = await storage
            .upload(fileName, imageToUpload, {
                contentType: "image/jpeg",
                cacheControl: "3600",
                upsert: false
            });
        if (error) {
            return {imageUrl: null, error: error};
        }
        const publicUrlResult = storage.getPublicUrl(data.path);
        const publicUrl = publicUrlResult.data?.publicUrl ?? publicUrlResult.publicURL;

        if (!publicUrl) {
            return {imageUrl: null, error: new Error("Impossible d'obtenir l'URL publique de l'image")};
        }

        return {imageUrl: publicUrl, error: null};
    } else {
        return {imageUrl: currentImageUrl, error: null};
    }
}

export function removeImage() {
    imageToUpload = null;
    currentImageUrl = null;
    eventImage.value = "";
    deleteImageBtn.hidden = true;
    eventForm.querySelector(".event-image-wrapper").hidden = true;
    eventForm.querySelector("#event-thumbnail").src = "";
    eventForm.querySelector("#file-name").textContent = "aucun fichier choisi";
}

export function formatPhoneInput(input) {
    const phoneFormatter = new libphonenumber.AsYouType();
    input.value = phoneFormatter.input(input.value.replace(/[^\d+]/g, ""));
}

export function getEventFormPayload() {
    const eventDate = eventForm.querySelector("#event_date");
    const endDate = eventForm.querySelector("#end_date");
    const phoneInput = eventForm.querySelector("#phone");
    const minAgeInput = eventForm.querySelector("#min_age");
    const maxAgeInput = eventForm.querySelector("#max_age");
    const long_description = eventForm.querySelector('#long_description').value
    const toEat = eventForm.querySelector('input[name="to_eat"]').checked;
    const toDrink = eventForm.querySelector('input[name="to_drink"]').checked;

    var phoneNumber = null;

    /* reset form custom validity */
    phoneInput.setCustomValidity("");
    tagInput.setCustomValidity("");
    eventDate.setCustomValidity("");
    endDate.setCustomValidity("");
    minPrice.setCustomValidity("");
    maxAgeInput.setCustomValidity("");

    /* check phone number */
    if (phoneInput.value && (phoneInput.value != "")) {
        try {
            const numData = libphonenumber.parsePhoneNumber(eventForm.querySelector('#phone').value);
            if (!numData.isValid()) {
                phoneInput.setCustomValidity("Numéro invalide");
            } else {
                phoneNumber = numData.number;
            
            }
        } catch {
            phoneInput.setCustomValidity("Numéro invalide");
        }
    }

    /* check userTags */
    if (userTags.length > 4) {
        tagInput.setCustomValidity("Maximum 4 tags");
    }
    /* require at least one tag (ignoring the internal "is_test" marker) */
    const tags = userTags.map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    if (tags.filter((t) => t !== "is_test").length === 0) {
        tagInput.setCustomValidity("Au moins un tag est requis");
    }

    // check dates, places and programme
    validateEndDate();
    const { locations, schedule } = readPlacesAndSchedule();
    const firstDay = schedule[0]?.date;
    // an event in progress keeps its first day when edited
    if (firstDay && firstDay < formatDateStr(today) && firstDay !== initialEventDate) {
        eventDate.setCustomValidity("La date doit être à partir de aujourd'hui");
    }

    /* set price */
    var min_price = null;
    var max_price = null;
    if (priceChoiceList.value == 2) {
        min_price = minPrice.value.trim() === "" ? 0.0: Number(minPrice.value);
        max_price = maxPrice.value.trim() === "" ? 0.0: Number(maxPrice.value);
        if ((min_price !== null) && (max_price !== null) && (min_price > max_price))
        {
            minPrice.setCustomValidity("Le prix réduit doit être inférieur au prix normal");
        }
    }

    /* check ages */
    const min_age = minAgeInput.value.trim() === "" ? null : Number(minAgeInput.value);
    const max_age = maxAgeInput.value.trim() === "" ? null : Number(maxAgeInput.value);
    if (min_age !== null && max_age !== null && min_age > max_age) {
        maxAgeInput.setCustomValidity("L'âge maximum doit être supérieur ou égal à l'âge minimum");
    }

    /* report form validity */
    const firstInvalid = markInvalidFields(eventForm);
    if (firstInvalid) {
        if (programmeBody.contains(firstInvalid)) {
            toggleProgramme(true);
        }

        openErrorModal("Le formulaire contient des erreurs", null, () => focusField(firstInvalid));
        return;
    };

    /* require at least one category */
    console.log("selectedCategories:", selectedCategories);
    if (selectedCategories.size === 0) {
        openErrorModal("Choisissez au moins une catégorie");
        return;
    }

    const payload = {
        title: eventForm.querySelector('#title').value,
        long_description: long_description === "" ? null : long_description,
        // event_date and end_date are set by the database from the schedule
        locations,
        schedule,
        tags,
        // pending: done later
        is_test: userTags.includes("is_test"),
        // created_by: done later
        // creator: done later
        price: priceChoiceList.value,
        min_price: min_price,
        max_price: max_price,
        category: Array.from(selectedCategories).map(Number).sort((a, b) => a - b),
        // image_url: done later
        phone: phoneNumber,
        email: eventForm.querySelector("#email").value,
        site_url: eventForm.querySelector('#site_url').value,
        min_age: min_age,
        max_age: max_age,
        to_eat: toEat,
        to_drink: toDrink
    }

    return {payload: payload}
}

/* read the place blocks and the programme into the database format, marking invalid fields
   (custom validity) on the way: postal code, same place twice a day, unused place, no day left */
function readPlacesAndSchedule() {
    const blocks = placeBlocks();
    const keys = placeKeys();

    const locations = blocks.map(block => {
        const codeInput = block.querySelector(".place-code");
        const code = codeInput.value.trim();
        codeInput.setCustomValidity(code && !/^[0-9]{5}$/.test(code) ? "Code postal à 5 chiffres" : "");
        const address2 = block.querySelector(".place-address-2").value.trim();
        return {
            name: block.querySelector(".place-name").value.trim(),
            address: block.querySelector(".search-address").value.trim(),
            address_2: address2 === "" ? null : address2,
            code,
            town: block.querySelector(".place-town").value.trim(),
        };
    });

    if (programmeContainer.hidden) {
        // simple form: one day, one place, the time input
        const date = eventDateInput.value;
        const time = startTimeInput.value;
        return { locations, schedule: date ? [{ date, time: time === "" ? null : time.slice(0, 5), loc: 0 }] : [] };
    }

    readProgrammeFromDom();
    const schedule = [];
    const usedPlaces = new Set();
    programme.forEach((day, date) => {
        if (day.removed) return;
        const seen = new Set();
        day.entries.forEach((entry, i) => {
            const select = programmeList.querySelector(`#programme-${date}-${i}-place`);
            select?.setCustomValidity(seen.has(entry.place) ? "Ce lieu est déjà prévu ce jour" : "");
            seen.add(entry.place);
            usedPlaces.add(entry.place);
            schedule.push({ date, time: entry.time === "" ? null : entry.time.slice(0, 5), loc: keys.indexOf(entry.place) });
        });
    });

    blocks.forEach(block => {
        block.querySelector(".place-name").setCustomValidity(usedPlaces.has(block.dataset.placeKey)
            ? "" : "Ce lieu n'est prévu à aucun jour du programme");
    });
    eventDateInput.setCustomValidity(schedule.length ? "" : "Gardez au moins un jour dans le programme");

    return { locations, schedule };
}

/* creator tile (super admins only): publish or edit an event on behalf of another account */
export async function loadProfiles() {
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

export function setCreatorFields(id, name, email) {
    eventForm.querySelector("#created_by").value = id ?? "";
    eventForm.querySelector("#creator_name").value = name ?? "";
    eventForm.querySelector("#creator_email").value = email ?? "";
}

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
