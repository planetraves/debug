---
hide:
  - navigation
  - toc
---

<div class="page-container guide" markdown>

#### Bienvenue sur planetraves.fr

Planet Raves est l'agenda culturel du Rabastinois : concerts, spectacles, expositions et autres évènements à **Rabastens, Couffouleux, Salvagnac et alentours**.

Ce guide présente rapidement comment utiliser le site.

---

#### Trouver un évènement

Sur la page [Évènements](index.md), deux affichages sont disponibles :

- <span class="material-symbols-outlined">view_agenda</span> **Liste** : les évènements à venir, regroupés par période (*Aujourd'hui*, *Prochainement*).
- <span class="material-symbols-outlined">calendar_month</span> **Agenda** : un calendrier mensuel. Chaque point coloré représente un évènement. Changez de mois avec les flèches ou en glissant le doigt vers la gauche / la droite, et touchez un jour pour voir ses évènements.

Touchez un évènement pour ouvrir sa fiche : description, horaires, prix, lieu (cliquable pour ouvrir la carte), contact et bouton de **partage**.

#### Les catégories

Chaque catégorie a sa propre icône et sa couleur, utilisées sur les fiches et dans l'agenda :

<div id="guide-categories" class="guide-categories"></div>

#### Filtrer les évènements

- Touchez une **catégorie** dans la barre d'outils pour n'afficher qu'elle, puis d'autres pour les ajouter.
- Ouvrez **Plus de filtres** pour affiner par zone géographique, âge du public, évènements gratuits / prix libre, ou rechercher par titre, lieu ou tag.
- Le bouton **Reset** réinitialise tous les filtres.

---

#### Publier un évènement

1. Créez un compte ou connectez-vous depuis [Mon compte](account.md).
2. Rendez-vous sur [Publier un évènement](submit.md) et remplissez le formulaire.
3. Validez : en tant que contributeur·rice, votre évènement est vérifié puis publié **sous trois jours**.

Pour être publié, un évènement doit être **culturel et artistique, ouvert au public, sur le territoire de Rabastens, Couffouleux, Salvagnac et alentours**.

!!! info "Vous organisez souvent des évènements ?"
    Depuis [Mon compte](account.md), demandez à devenir **contributeur·rice officiel·le** pour publier instantanément, sans attendre la validation.

Pour modifier ou supprimer un de vos évènements, ouvrez sa fiche : les boutons d'édition apparaissent en bas.

---

#### Installer l'application

Planet Raves peut être ajouté à l'écran d'accueil de votre téléphone ou ordinateur pour s'ouvrir comme une application, sans passer par le navigateur.

=== "iPhone / iPad"

    1. Ouvrez [planetraves.fr](https://planetraves.fr) dans **Safari**.
    2. Touchez le bouton **Partager** (carré avec une flèche vers le haut).
    3. Faites défiler et choisissez **Sur l'écran d'accueil**.
    4. Touchez **Ajouter**.

    Avec Chrome sur iPhone, le bouton **Partager** se trouve dans la barre d'adresse.

=== "Android"

    1. Ouvrez [planetraves.fr](https://planetraves.fr) dans **Chrome**.
    2. Touchez le menu **⋮** en haut à droite.
    3. Choisissez **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
    4. Confirmez avec **Ajouter**.

    Avec Firefox ou Samsung Internet, l'option se trouve aussi dans le menu du navigateur.

=== "Ordinateur"

    - **Chrome** : menu **⋮** → **Caster, enregistrer et partager** → **Créer un raccourci…**, cochez **Ouvrir dans une fenêtre**, puis **Créer**.
    - **Edge** : menu **…** → **Applications** → **Installer ce site en tant qu'application**.

L'icône Planet Raves apparaît alors avec vos autres applications.

---

#### Besoin d'aide ?

Une question, un problème ou une suggestion ? Contactez [l'équipe](contacts.md).

</div>

<script>
    document.documentElement.classList.add("ready");

    // APP_CONFIG comes from config.js, loaded after the page content
    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("guide-categories").innerHTML = Object.entries(APP_CONFIG.CATEGORIES).map(([id, cat]) => `
            <span class="guide-category" style="--cat-color: ${categoryColor(id)}; --cat-color-light: ${categoryColorLight(id)};">
                <span class="guide-category-badge material-symbols-outlined">${escapeHtml(cat.icon)}</span>
                <span class="guide-category-label">${escapeHtml(cat.label)}</span>
            </span>
        `).join("");
    });
</script>
