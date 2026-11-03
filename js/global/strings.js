console.log("executing:", "strings.js");

const stringsUrl = new URL("../../strings.json", import.meta.url);
let stringsPromise;

export async function getString(key) {
    if (!stringsPromise) {
        stringsPromise = fetch(stringsUrl).then(response => {
            if (!response.ok) {
                throw new Error(`Unable to load strings: ${response.status}`);
            }
            return response.json();
        }).catch(error => {
            stringsPromise = undefined;
            throw error;
        });
    }
    const strings = await stringsPromise;
    if (!Object.hasOwn(strings, key)) {
        throw new Error(`Unknown Markdown string: ${key}`);
    }
    return strings[key];
}

export async function applyStrings(root = document) {
    await Promise.all(Array.from(root.querySelectorAll("[data-string]"), async element => {
        element.innerHTML = await getString(element.dataset.string);
    }));
}