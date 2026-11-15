---
hide:
  - navigation
  - toc
---

{% include 'includes/modals/event_modal.html' %}
{% include 'includes/modals/share_modal.html' %}
{% include 'includes/modals/confirm_modal.html' %}
{% include 'includes/modals/popup.html' %}
{% include 'includes/nav/loading.html' %}
{% include 'includes/events/events.html' %}

{% block html %}
<script type="module" defer src="assets/js/events/router.js?v=dev"></script>
<html data-theme="light">
{% endblock %}
