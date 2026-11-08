/* === EXPORTED FUNCTIONS === */
export function renderOptionBtn(type, key, config, withicon=true) {
    const label = config["label"] ? config["label"] : config["label"];
    const iconHtml = withicon
        ? `<span class="material-symbols-outlined">${config["icon"]}</span>`
        : "";
    const action = (key == "when")
        ? "select-when-option"
        : "select-option";
    return `<button id="${type}-${key}-option" class="option-btn ${type} ${type}-${key} active" data-action="${action}" data-filter-type="${type}" data-filter-key="${key}">
                ${iconHtml}
                <span class="text">${label}</span>
            </button>`
}

export function renderSection(sectionKey, sectionTitle, subtitle, events) {
    if (events.length === 0) {
        return `
        <div class="section-tab empty selected" data-key="${sectionKey}">
            <div class="section-header">
                <span class="section-title">${sectionTitle}</span>
            </div>
            <div></div>
        </div>
        `;
    }

    return `
        <div class="section-tab section-${sectionKey} no-empty selected" data-key="${sectionKey}">
            <div class="section-header">
                <span class="section-title">${sectionTitle}</span>
            </div>
            <div>
                ${events.map(renderEventTile).join("")}
            </div>
        </div>
    `;
}

export function renderEventTile(event) {
    const eventData = renderEventData(event);

    return `
    <div class="event-tile" style="--event-color: ${eventData.categoryColor}"
            data-action="show-event" role="link" tabindex="0"
            data-event-id="${eventData.id}"
            data-category="${eventData.categoryIds.join(",")}"
            data-pg="${eventData.pg}"
            data-price="${eventData.price}"
            data-area="${eventData.areaId}"
            data-min-age="${eventData.min_age}"
            data-max-age="${eventData.max_age}"
            data-date="${eventData.event_date}">
        <div class="event-side" style="background: ${eventData.categoryPie}">
            <div class="event-category">${eventData.categoryLabel}</div>
            <div class="event-date">${formatEventDate(eventData.event_date)}</div>
            ${eventData.timeHtml}
        </div>

        <div class="event-content">
            <div class="event-title">${event.title}</div>
            <div class="event-meta">
                ${eventData.locationHtml}
            </div>
            <div class="event-meta">
                ${renderMaterialIconText("sell", eventData.priceLabel)}
                ${renderMaterialIconText("face", eventData.ageLabel)}
            </div>
            ${eventData.tagsHtml}
        </div>
    </div>
    `;
}

export function renderDots(dayEvents) {
    if (!dayEvents || !dayEvents.length) return "";

    const MAX = 4; // 2x2 slots per cell; when over, the last slot becomes "+N"
    const shown = dayEvents.length > MAX ? dayEvents.slice(0, MAX - 1) : dayEvents;

    let html = shown.map(ids => {
        const background = categoryPieBackground(ids);
        return `<span class="calendar-dot" style="background:${background}"></span>`;
    }).join("");

    const extra = dayEvents.length - shown.length;
    if (extra > 0) {
        html += `<span class="calendar-dot calendar-dot-more">+${extra}</span>`;
    }

    return html;
}

export function renderEventSuggestion(event) {
    const eventData = renderEventData(event);
    const html = `
        <div class="event-suggestion-title non-wrap">${event.title}</div>
        <div class="event-suggestion-meta non-wrap">
            <div style="color: ${eventData.categoryColor};">${eventData.categoryLabel}</div>
            .
            <div>${formatEventDateTime(eventData.event_date)}</div>
            .
            <div>${eventData.location_name}</div>
        </div>
    `
    return html;
}
