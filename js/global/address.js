console.log("executing:", "address.js");

/* Free address autocomplete via the French Base Adresse Nationale (api-adresse.data.gouv.fr).
   No API key required. The event listeners live in the page routers (submit / edit_event);
   this module only exposes the handlers they call. An event can have several places: each
   place block ([data-address-group]) has its own street input + suggestions; picking a
   suggestion fills that block's postal code / town fields. Manual entry always works. */

const API_URL = "https://api-adresse.data.gouv.fr/search/";

let inFlight = null;         // AbortController for the current request
let currentFeatures = [];    // last suggestions, indexed by data-index

// BAN spells some towns differently from local usage; keys are the API's city names
const CITY_FIXES = {
    "Coufouleux": "Couffouleux",
};

function fixCityName(feature) {
    const props = feature.properties;
    const fixed = props && CITY_FIXES[props.city];
    if (!fixed) return;
    // label is "<street or name> <postcode> <city>", so only rewrite the trailing city
    if (props.label?.endsWith(props.city)) {
        props.label = props.label.slice(0, -props.city.length) + fixed;
    }
    // town-level results (type "municipality") use the town itself as name
    if (props.name === props.city) props.name = fixed;
    props.city = fixed;
}

// reverse mapping: users type the local spelling, but the API only knows its own
const QUERY_FIXES = Object.entries(CITY_FIXES)
    .map(([api, local]) => [new RegExp(`\\b${local}\\b`, "gi"), api]);

function toApiQuery(value) {
    return QUERY_FIXES.reduce((q, [re, api]) => q.replace(re, api), value);
}

/* fields of the place block containing `el` (the street input or one of its suggestions) */
function getEls(el) {
    const group = el?.closest("[data-address-group]");
    const container = group?.querySelector(".address-autocomplete");
    if (!container) return null;
    return {
        input: container.querySelector(".search-address"),
        suggestionsEl: container.querySelector(".address-suggestions"),
        codeInput: group.querySelector(".place-code"),
        townInput: group.querySelector(".place-town"),
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
    const els = getEls(input);
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
        const url = `${API_URL}?q=${encodeURIComponent(toApiQuery(value))}&limit=5`;
        const res = await fetch(url, { signal: inFlight.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch (err) {
        if (err.name !== "AbortError") console.warn("Address suggestions failed:", err);
        return;
    }

    currentFeatures = data?.features || [];
    currentFeatures.forEach(fixCityName);
    if (currentFeatures.length === 0) {
        input.classList.remove("looking");
        hideAddressSuggestions();
        return;
    }

    hideAddressSuggestions(els.suggestionsEl);  // only one suggestion list open at a time
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
    const els = getEls(el);
    if (!props || !els) return;
    els.input.value = props.name || props.label || els.input.value;
    if (els.codeInput) els.codeInput.value = props.postcode || "";
    if (els.townInput) els.townInput.value = props.city || "";
    // programmatic value changes don't fire "input"; notify listeners (e.g. clear validation errors).
    // Not on the street input: its "input" listener would start a new search.
    [els.codeInput, els.townInput].forEach(i => i?.dispatchEvent(new Event("input", { bubbles: true })));
    els.input.classList.remove("looking");
    hideAddressSuggestions();
}

/* hide every suggestion list (except `keep`) */
export function hideAddressSuggestions(keep = null) {
    document.querySelectorAll(".address-autocomplete").forEach(container => {
        const suggestionsEl = container.querySelector(".address-suggestions");
        if (!suggestionsEl || suggestionsEl === keep) return;
        suggestionsEl.innerHTML = "";
        suggestionsEl.classList.add("hidden");
        container.querySelector(".search-address")?.classList.remove("looking");
    });
    if (!keep) currentFeatures = [];
}
