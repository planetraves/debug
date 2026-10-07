# sbdb — outil base de données Supabase

`sbdb.py` permet de sauvegarder (dump), modifier et migrer les bases Supabase **DEV** et
**PROD** du projet, sans le CLI Supabase (qui pose des problèmes de proxy / certificats
TLS sur le réseau d'entreprise).

Il gère aussi la config auth (URLs, templates d'email…), le déploiement des fonctions
Edge et quelques opérations sur les comptes utilisateur·rice·s.

Toutes les commandes se lancent **depuis la racine du dépôt**, après `activate.bat` :

```powershell
py tools/sbdb/sbdb.py <commande> [options]
```

---

## Sommaire

1. [Prérequis et configuration](#1-prérequis-et-configuration)
2. [Commandes](#2-commandes)
3. [Contenu d'un dump](#3-contenu-dun-dump)
4. [Workflow : modifier la base puis passer en PROD](#4-workflow--modifier-la-base-puis-passer-en-prod)
5. [Limitations et pièges](#5-limitations-et-pièges)
6. [Sécurité](#6-sécurité)

---

## 1. Prérequis et configuration

### Dépendances

`requests` (backend `api`, par défaut), `psycopg2-binary` (backend `pg`) et `keyring`.
Elles sont dans `requirements.txt` et installées par `activate.bat`.

### Backends (`--backend`)

| Backend | Fonctionnement | Besoin |
| --- | --- | --- |
| `api` *(défaut)* | SQL envoyé via l'API de gestion Supabase (HTTPS, passe par le proxy) | jeton d'accès |
| `pg` | connexion Postgres directe (port 5432) | mot de passe de la base |

La config auth et le déploiement de fonctions passent **toujours** par l'API.

### Variables d'environnement

Le fichier `planetraves.env` (racine du dépôt) est chargé automatiquement ; une
variable déjà définie dans l'environnement est prioritaire.

| Variable | Rôle |
| --- | --- |
| `SUPABASE_DEV_PROJECT_ID` / `SUPABASE_PROD_PROJECT_ID` | identifiant (ref) du projet |
| `SUPABASE_ACCESS_TOKEN` | jeton d'accès (backend `api`) |
| `SUPABASE_<ENV>_DB_PASSWORD` | mot de passe Postgres (backend `pg`) |
| `SUPABASE_<ENV>_DB_URL` | URL Postgres complète, remplace host/port/user/nom |
| `SUPABASE_<ENV>_DB_HOST` / `_PORT` / `_USER` / `_NAME` | défauts : `db.<ref>.supabase.co` / `5432` / `postgres` / `postgres` |
| `SUPABASE_SSLMODE` | défaut `require` |
| `PROXY_HOST` / `PROXY_PORT` / `PROXY_USER` | proxy d'entreprise (mot de passe lu dans `keyring`) |
| `SPB_CA_BUNDLE` | bundle de certificats CA pour `requests` |
| `SPB_INSECURE=1` | désactive la vérification TLS (dernier recours) |

### Secrets (si non définis en variable d'environnement)

| Secret | Emplacement |
| --- | --- |
| Jeton d'accès Supabase | `~/.supabase/planetraves.token` |
| Mot de passe DB (backend `pg`) | gestionnaire d'identifiants Windows, entrée `planetraves.dev.pwd` / `planetraves.prod.pwd` |
| Mot de passe proxy | gestionnaire d'identifiants Windows, entrée `<PROXY_HOST>` |

---

## 2. Commandes

Options globales, à placer **avant** la commande :

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--backend api\|pg` | `api` | voir [Backends](#backends---backend) |
| `--schema NOM\|all` | `all` | schéma à traiter ; `all` = tous les schémas utilisateur (hors schémas gérés par Supabase) |

```powershell
py tools/sbdb/sbdb.py --schema public dump --env dev     # correct
py tools/sbdb/sbdb.py dump --env dev --schema public     # ERREUR : option globale mal placée
```

Les commandes qui modifient une base demandent une confirmation `(y/N)` ; `--yes` la
saute. `--help` sur n'importe quelle commande affiche toutes les options.

### `dump` — sauvegarder une base

```powershell
py tools/sbdb/sbdb.py                                    # raccourci : dump complet de DEV
py tools/sbdb/sbdb.py dump --env prod                    # dump complet de PROD
py tools/sbdb/sbdb.py dump --env dev --schema-only       # structure seulement
py tools/sbdb/sbdb.py dump --env dev --data-only         # données seulement
py tools/sbdb/sbdb.py dump --env dev --include-all       # + comptes auth, storage, config auth
py tools/sbdb/sbdb.py dump --env dev --out dump/avant_refonte
```

| Option | Effet |
| --- | --- |
| `--out DIR` | dossier de sortie (défaut : `dump/<env>_<AAAAMMJJ_HHMMSS>/`) |
| `--schema-only` / `--data-only` | structure seule / données seules |
| `--clean` | ajoute `05_clean.sql` qui **supprime toutes les tables** avant de les recréer |
| `--include-auth` | données des comptes (`auth.users`, `identities`…) + fonctions/triggers auth |
| `--include-storage` | buckets et policies du storage |
| `--include-config` | config auth en JSON dans `config/` (**contient des secrets**) |
| `--include-all` | les trois options précédentes |

### `exec` — exécuter du SQL

Exécute un fichier `.sql`, ou **tous** les `.sql` d'un dossier de dump (par ordre de
nom, sous-dossiers compris) dans **une seule transaction** : en cas d'erreur, rien
n'est appliqué.

```powershell
py tools/sbdb/sbdb.py exec --env dev --file sql/correctif.sql
py tools/sbdb/sbdb.py exec --env dev --file dump/dev_20261007_151544
```

Un avertissement s'affiche si le SQL contient `DROP`.

> Un fichier `.sql` seul est envoyé tel quel : ajoutez vous-même `BEGIN; … COMMIT;`
> si vous voulez qu'il soit transactionnel.

### `query` — lancer une requête

```powershell
py tools/sbdb/sbdb.py query --env dev "SELECT count(*) FROM events"
py tools/sbdb/sbdb.py query --env prod "SELECT id, email FROM profiles" --json
```

### `migrate` — copier DEV vers PROD

Fait un dump de la source (dans `dump/migrate_<from>_to_<to>_<date>/`), demande
confirmation, puis l'applique à la cible avec `exec`.

```powershell
py tools/sbdb/sbdb.py migrate                                  # structure DEV -> PROD
py tools/sbdb/sbdb.py migrate --from dev --to prod --include-storage --include-config
py tools/sbdb/sbdb.py migrate --from prod --to dev --include-data --clean   # recopier PROD dans DEV
```

| Option | Effet |
| --- | --- |
| `--from` / `--to` | source / cible (défaut `dev` -> `prod`) |
| `--include-data` | copie aussi les données (par défaut : **structure seulement**) |
| `--clean` | **supprime toutes les tables de la cible** (données comprises) avant |
| `--include-auth` / `--include-storage` / `--include-config` | comme pour `dump` |
| `--include-all` | `--include-data` + les trois précédentes |

Si vous répondez `N` à la confirmation, le dossier de dump est conservé pour relecture.

### `config` — config auth (URLs, templates d'email, connexion, fournisseurs)

```powershell
py tools/sbdb/sbdb.py config get --env dev                       # affiche le JSON
py tools/sbdb/sbdb.py config get --env dev --out dump/config_dev # écrit config/auth.json
py tools/sbdb/sbdb.py config apply --env prod --file dump/config_dev/auth.json
```

`--file` accepte un fichier JSON, un dossier de config ou un dossier de dump (contenant
`config/`).

### `deploy-function` — déployer une fonction Edge

```powershell
py tools/sbdb/sbdb.py deploy-function send-email --env dev
py tools/sbdb/sbdb.py deploy-function send-email --env prod
```

Source par défaut : `supabase/functions/<slug>/`, point d'entrée `index.ts`.
`--path DIR` et `--entrypoint FICHIER` pour changer ; `--no-verify-jwt` désactive la
vérification du JWT par la passerelle (la fonction fait alors sa propre authentification).

### `delete-user` — supprimer un compte

```powershell
py tools/sbdb/sbdb.py delete-user test@example.com --env dev
py tools/sbdb/sbdb.py delete-user 3f2b...-uuid --env prod
```

Supprime le compte dans `auth.users` ; le profil est supprimé en cascade et les
évènements du compte gardent `created_by = NULL`. **Irréversible.**

### `update-email` — changer l'email d'un compte

```powershell
py tools/sbdb/sbdb.py update-email ancien@example.com nouveau@example.com --env prod
```

Met à jour `auth.users`, l'identité email et `profiles.email` en une transaction, sans
email de confirmation.

---

## 3. Contenu d'un dump

Un dump est un dossier de fichiers numérotés, appliqués dans l'ordre des noms :

| Fichier | Contenu |
| --- | --- |
| `00_session.sql` | paramètres de session, `search_path` |
| `05_clean.sql` | *(avec `--clean`)* `DROP TABLE … CASCADE` de toutes les tables |
| `08_schemas.sql` | création des schémas autres que `public` |
| `10_extensions.sql` | extensions |
| `20_types.sql` | types enum |
| `30_sequences.sql` | séquences |
| `40_functions.sql` / `42_auth_functions.sql` | fonctions (`CREATE OR REPLACE`) |
| `50_tables.sql` | tables et colonnes |
| `60_data/<table>.sql` | données (`INSERT`) |
| `62_storage_buckets.sql` | buckets storage (upsert) |
| `70_constraints.sql` | clés primaires, uniques, checks, clés étrangères |
| `75_indexes.sql` | index |
| `80_sequence_values.sql` | valeurs courantes des séquences |
| `85_views.sql` | vues |
| `90_triggers.sql` / `92_auth_triggers.sql` | triggers |
| `95_policies.sql` / `96_storage_policies.sql` | RLS et policies |
| `97_cron.sql` | tâches planifiées (`pg_cron`) |
| `98_grants.sql` | droits des rôles `anon`, `authenticated`, `service_role` |
| `config/auth.json` | *(avec `--include-config`)* config auth |

### Le SQL est ré-exécutable

La structure générée **aligne** une base existante sur le dump, au lieu de seulement
créer ce qui manque. On peut donc l'appliquer plusieurs fois et sur une base déjà
remplie :

| Objet | Comportement à l'application |
| --- | --- |
| Tables | créées si absentes ; colonnes manquantes ajoutées ; `DEFAULT` et `NOT NULL` alignés |
| Vues | supprimées puis recréées (options comme `security_invoker` conservées) |
| Fonctions | `CREATE OR REPLACE` |
| Triggers, policies | supprimés puis recréés |
| Contraintes | ajoutées si absentes (une contrainte existante n'est **pas** modifiée) |
| Index, extensions, types, séquences | créés si absents |
| Droits | réappliqués |

---

## 4. Workflow : modifier la base puis passer en PROD

**DEV est la référence.** On modifie DEV, on teste, puis on recopie la structure vers
PROD avec `migrate`.

### A. Changement couvert par le dump (ajout de colonne, vue, fonction, policy…)

```powershell
# 1. partir de l'état actuel de DEV
py tools/sbdb/sbdb.py dump --env dev --schema-only --out dump/travail

# 2. modifier les fichiers, par ex. dump/travail/50_tables.sql :
#      ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "end_date" date;
#    et/ou dump/travail/85_views.sql

# 3. appliquer à DEV (une seule transaction)
py tools/sbdb/sbdb.py exec --env dev --file dump/travail

# 4. tester le site sur DEV

# 5. passer en PROD
py tools/sbdb/sbdb.py migrate --from dev --to prod
```

### B. Changement non couvert (suppression / renommage / changement de type de colonne, données)

Écrire un petit fichier SQL dédié, l'appliquer à DEV puis à PROD :

```sql
-- sql/20261012_renommer_colonne.sql
BEGIN;
ALTER TABLE public.events RENAME COLUMN to_eat TO has_food;
COMMIT;
```

```powershell
py tools/sbdb/sbdb.py exec --env dev  --file sql/20261012_renommer_colonne.sql
# tester, puis :
py tools/sbdb/sbdb.py exec --env prod --file sql/20261012_renommer_colonne.sql
```

> Faites ensuite un nouveau `dump` de DEV pour que le dossier de référence reflète
> le nouvel état.

### C. Avant toute opération sur PROD

```powershell
py tools/sbdb/sbdb.py dump --env prod --include-all --out dump/prod_backup_AAAAMMJJ
```

---

## 5. Limitations et pièges

- **Colonnes jamais supprimées, renommées ni retypées** par un dump : une colonne
  absente du dump reste en base. Utilisez un fichier SQL dédié (workflow B).
- **Colonne `NOT NULL` sans valeur par défaut ajoutée à une table non vide** : échoue
  (les lignes existantes n'ont pas de valeur), et toute la transaction est annulée.
  Ajoutez d'abord la colonne sans `NOT NULL`, remplissez-la, puis activez `NOT NULL`.
- **`SET NOT NULL` sur une colonne contenant des `NULL`** dans la cible : échoue de même.
- **Contraintes modifiées** : une contrainte qui existe déjà (même nom) n'est pas
  remplacée. Pour la changer, supprimez-la dans un fichier SQL dédié.
- **Éléments supprimés dans DEV** (fonction, policy, trigger, index, vue) : ils ne sont
  **pas** supprimés dans la cible par `migrate`. Supprimez-les avec un fichier SQL dédié.
- **Vues dépendant d'autres vues** : les vues sont recréées par ordre alphabétique ;
  une vue qui en utilise une autre créée plus loin fera échouer l'application.
- **`--include-data` sur une cible non vide** : les `INSERT` n'ont pas de
  `ON CONFLICT`, donc les lignes déjà présentes provoquent une erreur de clé dupliquée.
  À utiliser sur une base vide ou avec `--clean`.
- **`--clean`** supprime **toutes les tables et leurs données** de la cible.
  Uniquement pour reconstruire une base (par ex. recopier PROD dans DEV).
- **`pg_cron`** : `97_cron.sql` reprogramme les tâches ; une tâche sans nom peut être
  créée en double à chaque application.
- **Option globale** : `--schema` et `--backend` se placent **avant** la commande.
- **Gros volumes** : le backend `api` envoie tout le SQL en une requête (timeout 120 s) ;
  pour de gros dumps de données, préférez `--backend pg`.
- **Schémas gérés par Supabase** (`auth`, `storage`, `realtime`…) : non dumpés, sauf
  les données/objets ciblés par `--include-auth` et `--include-storage`.

---

## 6. Sécurité

- `dump/` contient des **données personnelles** (emails, profils) dès qu'on dumpe les
  données, et `config/auth.json` contient des **secrets** (SMTP, fournisseurs OAuth).
  Ne les commitez pas et ne les partagez pas.
- Les commandes s'exécutent avec les droits `postgres` : **la RLS ne s'applique pas**.
  Relisez le SQL avant un `exec` sur PROD.
- Les vues sont lisibles par `anon` / `authenticated` (voir `98_grants.sql`) : n'y
  exposez pas de colonnes sensibles (ex. `creator_email`). Gardez
  `security_invoker = on` pour que la RLS des tables s'applique aux vues.
- Faites toujours un dump de sauvegarde de PROD avant un `migrate` ou un `exec` sur PROD.
