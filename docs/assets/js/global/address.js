console.log("executing:", "address.js");

/* Free address autocomplete via the French Base Adresse Nationale (api-adresse.data.gouv.fr).
   No API key required. The event listeners live in the page routers (submit / edit_event);
   this module only exposes the handlers they call. Suggestions fill the street / postal code /
   town fields; manual entry always works. */

const API_URL = "https://api-adresse.data.gouv.fr/search/";

let inFlight = null;         // AbortController for the current request
let currentFeatures = [];    // last suggestions, indexed by data-index

function getEls() {
    const container = document.getElementById("address-autocomplete");
    if (!container) return null;
    return {
        input: document.getElementById("location_address"),
        suggestionsEl: container.querySelector(".address-suggestions"),
        codeInput: document.getElementById("location_address_code"),
        townInput: document.getElementById("location_address_town"),
    };
}

function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

async function runSearch(input) {
    const els = getEls();
    if (!els?.suggestionsEl) return;

    const value = input.value.trim();
    if (value.length < 3) {
        input.classList.remove("looking");
        hideAddressSuggestions();
        return;
    }

    if (inFlight) inFlight.abort();
    inFlight = new AbortController();

    let data;
    try {
        const url = `${API_URL}?q=${encodeURIComponent(value)}&limit=5`;
        const res = await fetch(url, { signal: inFlight.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch (err) {
        if (err.name !== "AbortError") console.warn("Address suggestions failed:", err);
        return;
    }

    currentFeatures = data?.features || [];
    if (currentFeatures.length === 0) {
        input.classList.remove("looking");
        hideAddressSuggestions();
        return;
    }

    els.suggestionsEl.innerHTML = "";
    currentFeatures.forEach((feature, index) => {
        const props = feature.properties;
        if (!props) return;
        const div = document.createElement("div");
        div.className = "address-suggestion";
        div.dataset.action = "select-address";
        div.dataset.index = index;
        div.textContent = props.label;
        els.suggestionsEl.appendChild(div);
    });

    input.classList.add("looking");
    els.suggestionsEl.classList.remove("hidden");
}

const debouncedSearch = debounce(runSearch, 300);

/* === EXPORTED FUNCTIONS (called by the routers) === */
export function searchAddress(input) {
    debouncedSearch(input);
}

export function selectAddress(el) {
    const props = currentFeatures[Number(el.dataset.index)]?.properties;
    const els = getEls();
    if (!props || !els) return;
    els.input.value = props.name || props.label || els.input.value;
    if (els.codeInput) els.codeInput.value = props.postcode || "";
    if (els.townInput) els.townInput.value = props.city || "";
    // programmatic value changes don't fire "input"; notify listeners (e.g. clear validation errors)
    [els.codeInput, els.townInput].forEach(i => i?.dispatchEvent(new Event("input", { bubbles: true })));
    if (els.input) els.input.classList.remove("looking");
    hideAddressSuggestions();
}

export function hideAddressSuggestions() {
    const els = getEls();
    if (!els?.suggestionsEl) return;
    els.suggestionsEl.innerHTML = "";
    if (els.input) els.input.classList.remove("looking");
    els.suggestionsEl.classList.add("hidden");
    currentFeatures = [];
}
