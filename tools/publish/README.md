# publish — publier de vrais évènements en PROD

`publish.py` publie de **vrais** évènements dans la base Supabase **PROD** à partir d'un
fichier JSON. Pour chaque évènement, le JSON donne le **chemin d'une image locale** (au lieu
d'une URL) : le script la compresse comme le site web, l'envoie dans le bucket de stockage
`event-images`, puis enregistre son URL publique dans `events.image_url` en créant
l'évènement.

Le script fonctionne sous **Windows** et **macOS** (et Linux).

---

## Sommaire

- [publish — publier de vrais évènements en PROD](#publish--publier-de-vrais-évènements-en-prod)
  - [Sommaire](#sommaire)
  - [1. Installation](#1-installation)
  - [2. Secrets à enregistrer sur le poste](#2-secrets-à-enregistrer-sur-le-poste)
    - [Clé service\_role (PROD)](#clé-service_role-prod)
    - [Clé service\_role (DEV)](#clé-service_role-dev)
    - [Mot de passe du proxy (réseau d'entreprise)](#mot-de-passe-du-proxy-réseau-dentreprise)
  - [3. Format du fichier JSON](#3-format-du-fichier-json)
  - [4. Utilisation](#4-utilisation)
  - [5. Ce que fait le script](#5-ce-que-fait-le-script)
  - [6. Dépannage](#6-dépannage)

---

## 1. Installation

Depuis la racine du dépôt, activez le projet (une fois par terminal) :

| Système | Commande |
| --- | --- |
| Windows | `activate.bat` |
| macOS / Linux | `source ./activate.sh` |

L'activation installe les dépendances de `requirements.txt`, dont `Pillow` (compression
des images) et `phonenumbers` (validation des numéros de téléphone), et charge
`planetraves.env`. Le script relit aussi `planetraves.env` de lui-même ; il y utilise :

| Variable | Rôle |
| --- | --- |
| `SUPABASE_PROD_URL` / `SUPABASE_DEV_URL` | URL du projet Supabase visé |
| `PROXY_HOST` / `PROXY_PORT` / `PROXY_USER` | proxy d'entreprise (utilisé seulement s'il est joignable) |
| `SPB_CA_BUNDLE` | bundle de certificats CA (fichier `.pem`) pour la connexion HTTPS |
| `SPB_INSECURE=1` | désactive la vérification TLS, **uniquement** à travers le proxy d'entreprise |

## 2. Secrets à enregistrer sur le poste

Les secrets sont lus dans le **trousseau du système** via `keyring` : le
**Gestionnaire d'identifiants** sous Windows, le **Trousseau d'accès** (Keychain) sous
macOS. Ils ne doivent **jamais** être écrits dans `planetraves.env` (versionné dans Git),
dans le JSON ou dans le code.

| Secret | Service keyring | Utilisateur keyring | Nécessaire |
| --- | --- | --- | --- |
| clé `service_role` du projet **PROD** | `planetraves.prod.servicerolekey` | `planetraves` | toujours |
| clé `service_role` du projet **DEV** | `planetraves.dev.servicerolekey` | `planetraves` | pour répéter sur DEV (`--env dev`) |
| mot de passe du proxy d'entreprise | valeur de `PROXY_HOST` | valeur de `PROXY_USER` | seulement derrière le proxy d'entreprise |

### Clé service_role (PROD)

1. Dans Supabase, ouvrez le projet **PROD** → **Project Settings → API Keys** et copiez
   la clé secrète nommée `publish_tool`.
2. Dans un terminal où le projet est activé, enregistrez-la une fois (même commande sous
   Windows et macOS) :

   ```sh
   python -m keyring set planetraves.prod.servicerolekey planetraves
   ```

   Collez la clé quand le mot de passe est demandé (rien ne s'affiche pendant la saisie,
   c'est normal).
3. Vérifiez sans l'afficher avec un essai à blanc (`--dry-run`, voir
   [Utilisation](#4-utilisation)).

Où retrouver l'entrée :

- **Windows** : *Panneau de configuration → Gestionnaire d'identifiants → Informations
  d'identification Windows → Informations d'identification génériques*, entrée
  `planetraves.prod.servicerolekey`.
- **macOS** : application *Trousseau d'accès*, trousseau *session*, élément
  `planetraves.prod.servicerolekey`. Au premier lancement du script, macOS demande si
  Python peut utiliser cet élément : saisissez le mot de passe de la session et choisissez
  **Toujours autoriser** (la question revient si l'environnement `venv/` est recréé).

> ⚠️ La clé `service_role` donne **tous les droits** sur la base (elle contourne les règles
> RLS). Ne la partagez pas, ne la commitez pas, ne la collez pas dans un fichier.

Sans trousseau utilisable (Linux sans bureau, CI…), la clé peut être fournie par la
variable d'environnement `SUPABASE_PROD_SERVICE_ROLE_KEY` (resp.
`SUPABASE_DEV_SERVICE_ROLE_KEY`), définie dans le terminal uniquement. Le trousseau reste
préférable : une variable tapée en ligne de commande finit dans l'historique du shell.

### Clé service_role (DEV)

Même procédure avec le projet **DEV** et le service `planetraves.dev.servicerolekey`
(c'est la même entrée que celle utilisée par `tools/dummy/create.py`) :

```sh
python -m keyring set planetraves.dev.servicerolekey planetraves
```

### Mot de passe du proxy (réseau d'entreprise)

Si `PROXY_HOST` et `PROXY_USER` sont définis dans `planetraves.env`, le mot de passe du
proxy est lu sous le service `<PROXY_HOST>` (même entrée que pour `sbdb.py`) :

```sh
python -m keyring set <PROXY_HOST> <PROXY_USER>
```

Hors du réseau d'entreprise (à la maison, sur un Mac personnel…), le nom du proxy ne se
résout pas : le script l'affiche et se connecte directement, sans rien à changer.

## 3. Format du fichier JSON

Le fichier (encodé en UTF-8) contient une **liste d'évènements** qui reprend les champs du
formulaire de publication du site, avec les noms des colonnes de la table `events` (comme
`tools/dummy/dummy-events.json`), et `image_path` à la place de `image_url` :

```json
[
    {
        "title": "Concert de Noël",
        "category": ["concert"],
        "tags": ["jazz", "noël"],
        "event_date": "2026-12-20",
        "event_start_time": "20:30",
        "location_name": "La Halle",
        "location_address": "2 place du Marché",
        "location_address_code": "81800",
        "location_address_town": "Rabastens",
        "long_description": "Le grand concert de fin d'année.\nBuvette sur place.",
        "price": 2,
        "min_price": 5,
        "max_price": 10,
        "phone": "06 12 34 56 78",
        "site_url": "https://example.org",
        "to_drink": true,
        "image_path": "images/concert-noel.jpg"
    },
    {
        "_note": "les champs commençant par _ sont ignorés",
        "title": "Festival des arts de rue",
        "category": [1, 5],
        "tags": ["cirque", "festival"],
        "event_date": "2027-06-12",
        "end_date": "2027-06-14",
        "location_name": "Promenade des Lices",
        "location_address": "Promenade des Lices",
        "location_address_code": "81800",
        "location_address_town": "Rabastens",
        "min_age": 3,
        "creator_email": "organisateur@example.org",
        "image_path": "images/festival.png"
    }
]
```

| Champ | Obligatoire | Description |
| --- | --- | --- |
| `title` | oui | titre, 60 caractères maximum |
| `category` | oui | liste de catégories : numéros `0` à `5` ou noms `concert`, `spectacle`, `projection`, `exposition`, `rencontre`, `autre` |
| `tags` | oui | liste de 1 à 4 tags (mis en minuscules) |
| `event_date` | oui | date `AAAA-MM-JJ`, aujourd'hui ou plus tard |
| `end_date` | non | dernier jour `AAAA-MM-JJ` d'un évènement sur plusieurs jours (8 jours maximum) : une ligne est créée par jour, comme sur le site |
| `event_start_time` | non | heure de début : `20:30` ou `20h30` |
| `location_name` | oui | nom du lieu |
| `location_address` | oui | numéro et rue |
| `location_address_2` | non | complément d'adresse |
| `location_address_code` | oui | code postal à 5 chiffres |
| `location_address_town` | oui | ville |
| `long_description` | non | description (`\n` pour un retour à la ligne) |
| `price` | non | `0` gratuit (par défaut), `1` prix libre, `2` payant ; ou `"gratuit"`, `"prix libre"`, `"payant"` |
| `min_price` / `max_price` | non | prix réduit / prix normal en euros, seulement si `price` vaut `2` |
| `min_age` / `max_age` | non | âges de 0 à 18 |
| `phone` | non | numéro valide (`06 12 34 56 78` ou `+33 6 12 34 56 78`), enregistré au format `+33612345678` comme sur le site |
| `email` | non | email de contact affiché sur l'évènement |
| `site_url` | non | site web |
| `to_eat` / `to_drink` | non | `true` / `false` (par défaut `false`) : on peut manger / boire sur place |
| `image_path` | non | image locale (JPEG, PNG, WebP, GIF, BMP, TIFF) ; chemin absolu ou **relatif au dossier du fichier JSON** |
| `creator_email` | non | email du compte auquel rattacher l'évènement ; par défaut celui de l'option `--creator` |

À savoir :

- Écrivez les chemins d'image avec des `/` (`images/flyer.jpg`) : le même JSON
  fonctionne alors sous Windows et macOS (les `\` sont aussi acceptés).
- Une image utilisée par plusieurs évènements n'est envoyée qu'une fois.
- Les champs remplis par le script sont refusés : `image_url`, `created_by`,
  `creator_name`, `pending`, `is_test`, `id`, `created_at`.
- Le compte créateur doit exister dans la base visée (les comptes DEV et PROD sont
  distincts). `created_by`, `creator_name` et `creator_email` sont remplis à partir de son
  profil : ce compte pourra ensuite modifier l'évènement depuis le site.

## 4. Utilisation

Depuis la racine du dépôt, projet activé :

```sh
# 1. essai à blanc : vérifie le JSON, compresse les images, contrôle le compte et les doublons
python tools/publish/publish.py mes-evenements.json --creator vous@example.org --dry-run

# 2. (facultatif) répétition sur DEV, où les évènements sont marqués is_test
python tools/publish/publish.py mes-evenements.json --creator vous@example.org --env dev

# 3. publication en PROD (une confirmation est demandée)
python tools/publish/publish.py mes-evenements.json --creator vous@example.org
```

| Option | Rôle |
| --- | --- |
| `--creator EMAIL` | compte auquel rattacher les évènements sans `creator_email` |
| `--env prod\|dev` | base visée (par défaut `prod`) ; sur `dev`, les évènements sont marqués `is_test` |
| `--dry-run` | tout vérifier sans rien envoyer ni publier |
| `--yes` | ne pas demander de confirmation |
| `--allow-duplicates` | publier même si un évènement de même titre existe déjà à la même date |
| `--no-proxy` | ignorer `PROXY_HOST` et se connecter directement |

Les évènements de répétition sur DEV se suppriment avec
`python tools/dummy/create.py -d event 0` (supprime **tous** les évènements `is_test` de
DEV).

## 5. Ce que fait le script

1. **Valide tous les évènements** avec les règles du formulaire du site. Si un seul est
   invalide, toutes les erreurs sont listées et **rien n'est publié**.
2. **Compresse chaque image** comme le site (`resizeImage()` dans
   `docs/assets/js/global/eventform.js`) : rotation EXIF appliquée, largeur ramenée à
   1200 px maximum (proportions gardées, jamais agrandie), couleurs converties en sRGB,
   transparence remplacée par du blanc, JPEG qualité 0.8. Les métadonnées (EXIF, position
   GPS) sont supprimées. Il n'y a pas de limite de taille pour l'image source : la
   compression est faite sur le poste.
3. Se connecte au projet avec la clé `service_role`, retrouve le profil de chaque
   créateur et **recherche les doublons** (même titre à la même date), qui sont ignorés.
4. Affiche le récapitulatif (dates, lieu, créateur, image avant/après compression) et
   demande confirmation.
5. Pour chaque évènement : envoie l'image dans le bucket `event-images` sous le nom
   `event-<uuid>.jpg` (cache d'1 h, comme le site), puis crée la ou les lignes (une par
   jour, en une seule requête : tous les jours ou aucun) avec `pending = false` et
   `is_test = false` en PROD. Si la création échoue, l'image envoyée est supprimée.

Si un évènement échoue, les suivants sont quand même publiés et le script se termine en
erreur. Corrigez puis relancez **la même commande** : les évènements déjà publiés sont
reconnus comme doublons et ignorés.

## 6. Dépannage

| Message | Solution |
| --- | --- |
| `service_role key of PROD not found` | enregistrez la clé : `python -m keyring set planetraves.prod.servicerolekey planetraves` |
| `no PROD account for: …` | le créateur (`--creator` / `creator_email`) doit avoir un compte sur le site PROD |
| `Missing Python package …` | relancez le script d'activation (`activate.bat` / `source ./activate.sh`) |
| `cannot read the image ….heic` | photo iPhone (HEIC) : `python -m pip install pillow-heif`, ou exportez-la en JPEG (Aperçu → Exporter… sous macOS) |
| `proxy … is not reachable from this network` | information seulement : connexion directe hors du réseau d'entreprise |
| erreur de certificat TLS derrière le proxy | définissez `SPB_CA_BUNDLE` (bundle `.pem` de l'entreprise) ou, en dernier recours, `SPB_INSECURE=1` |
| erreur de proxy (407, connexion refusée) | enregistrez le mot de passe du proxy (voir plus haut) ou essayez `--no-proxy` |
