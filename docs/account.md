---
hide:
  - navigation
  - toc
---

{% include 'includes/modals/profile_modal.html' %}
{% include 'includes/modals/event_modal.html' %}
{% include 'includes/modals/confirm_modal.html' %}
{% include 'includes/modals/popup.html' %}
{% include 'includes/nav/loading.html' %}
{% include 'includes/forms/resetpwd_form.html' %}
{% include 'includes/forms/signin_form.html' %}
{% include 'includes/forms/signup_form.html' %}
{% include 'includes/account/account_details.html' %}

{% block html %}
<script type="module" defer src="../assets/js/account/router.js?v=dev"></script>
<html data-theme="light">
{% endblock %}
