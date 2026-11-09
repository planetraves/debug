"""MkDocs hook: select environment assets and inject Supabase config.

Runs on every `mkdocs build` and `mkdocs serve`. By default it selects DEV
assets and credentials; when DEPLOY_ENV=prod (set by deploy.py --release) it
selects PROD assets and credentials. Credentials come from planetraves.env,
loaded by activate.bat.
"""
import os

_TARGET = os.path.join("assets", "js", "global", "config.js")


def on_config(config, **kwargs):
    dev = os.environ.get("DEPLOY_ENV") != "prod"
    color = "rose" if dev else "bleu"
    theme = config["theme"]
    theme["favicon"] = f"assets/images/ico-raves-{color}.ico"
    theme["logo"] = f"assets/images/ico-raves-{color}.png"
    return config


def on_post_build(config, **kwargs):
    path = os.path.join(config["site_dir"], _TARGET)
    if not os.path.isfile(path):
        return

    dev = False if os.environ.get("DEPLOY_ENV") == "prod" else True
    mode = "DEV" if dev else "PROD"
    url = os.environ.get(f"SUPABASE_{mode}_URL", "")
    key = os.environ.get(f"SUPABASE_{mode}_ANON_KEY", "")
    email_address = os.environ.get(f"SUPABASE_{mode}_EMAIL_ADDRESS", "")
    email_name = os.environ.get(f"SUPABASE_{mode}_EMAIL_NAME", "")
    site_url = os.environ.get(f"SITE_{mode}_URL", "")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace("__DEPLOY_DEV__", "true" if dev else "false")
    content = content.replace("__SUPABASE_URL__", url)
    content = content.replace("__SUPABASE_ANON_KEY__", key)
    content = content.replace("__SUPABASE_EMAIL_ADDRESS__", email_address)
    content = content.replace("__SUPABASE_EMAIL_NAME__", email_name)
    content = content.replace("__SITE_URL__", site_url)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
