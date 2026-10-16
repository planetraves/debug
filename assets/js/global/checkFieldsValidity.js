console.log("executing:", "checkFieldsValidity.js");

export function clearFieldError(el) {
    el.classList.remove("field-invalid");
    el.removeAttribute("aria-invalid");
    const msg = el.parentElement?.querySelector(`.field-error-msg[data-for="${el.id || el.name}"]`);
    if (msg) msg.remove();
}

/* mark every invalid field with an inline message, returns the first one */
export function markInvalidFields(form, insertMsg=true) {
    form.querySelectorAll(".field-invalid").forEach(clearFieldError);
    let first = null;
    Array.from(form.elements).forEach(el => {
        if (!el.willValidate || el.validity.valid) return;
        if (!first) first = el;
        el.classList.add("field-invalid");
        el.setAttribute("aria-invalid", "true");
        const msg = document.createElement("small");
        msg.className = "field-error-msg";
        msg.dataset.for = el.id || el.name;
        if (insertMsg) {
            msg.textContent = el.validationMessage;
            el.insertAdjacentElement("afterend", msg);
        }
    });
    return first;
}

export function focusField(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
}
