console.log("executing:", "tags.js");

const tagContainer = document.getElementById("tag-container");

export const tagInput = document.getElementById("tag-input");
export let userTags = [];

/* === LOCAL FUNCTIONS === */
function removeTag(tagToRemove) {
    userTags = userTags.filter(tag => tag !== tagToRemove);
    renderTags();
}

function renderTags() {
    // Remove existing chips
    tagContainer
        .querySelectorAll(".tag-chip")
        .forEach(el => el.remove());

    // Add chips before the input
    userTags.forEach(tag => {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = tag;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.innerHTML = "&times;";
        removeBtn.addEventListener("click", () => {
            removeTag(tag);
        });

        chip.appendChild(removeBtn);
        tagContainer.insertBefore(chip, tagInput);
    });

    tagInput.value = "";
    // tag list changed programmatically; notify listeners (e.g. clear validation errors)
    tagInput.dispatchEvent(new Event("input", { bubbles: true }));
}


/* === EXPORTED FUNCTIONS === */
export function clearTags() {
    userTags = [];
    renderTags();
}

export function addTag(tag=null) {
    var newTag = null;
    if (tag) {
        newTag = tag;
    } else {
        tag = tagInput.value.trim().toLowerCase();
    }

    if (!tag || userTags.includes(tag)) {
        return;
    }

    userTags.push(tag);
    renderTags();
}

export function removeLastTag() {
    if (tagInput.value != "" || userTags.length > 0) return;
    removeTag(userTags[userTags.length - 1]);
}

/* === LISTENER === */
/* Handle blur (optional) */
tagInput.addEventListener("blur", () => {
    addTag();
});

