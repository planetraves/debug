#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
import re
import yaml
import argparse
import random
import argparse

PROJECT_ROOT_FOLDER = os.path.expandvars("$PROJECT_ROOT_FOLDER")
SEPARATOR = "-----------------------------"

# -----------------------------------------
# Helpers
# -----------------------------------------
def error(msg: str):
    print(f"❌ {msg}")


def success(msg: str):
    print(f"✅ {msg}")


def run(cmd, cwd=None, check=True, print_cmd=False, noexit=False):
    """Run a shell command with optional working directory."""
    if print_cmd:
        print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if check and result.returncode != 0:
        error(f"command failed: {cmd}")
        if not noexit:
            sys.exit(1)
    return result.returncode


def yesno(prompt):
    """Ask the user (y/n/q)"""
    ans = input(prompt + " (y/n/q) ").strip().lower()
    if ans == "q":
        print("exit requested by user")
        sys.exit(0)
    return ans == "y"

# -----------------------------------------
# WORKFLOW
# -----------------------------------------
def initialization() -> str:
    print("[[[[[[ Initialization ]]]]]]")

    # detect release hash
    hash = subprocess.check_output("git rev-parse --short HEAD", shell=True).decode().strip()
    print(f"Detected release hash: {hash}")
    return hash


def check_git_repos():
    print("[[[[[[ Check git repositories ]]]]]]")
    err = 0

    # check repo is clean
    dirty = subprocess.check_output("git status --porcelain", shell=True).decode()
    if dirty.strip():
        error("repo is NOT clean:")
        print(dirty)
        err = 1
    else:
        success("repo is clean")

    # check repo points to origin/master
    run("git fetch -p", check=False)
    head = subprocess.check_output("git rev-parse HEAD", shell=True).decode().strip()
    origin = subprocess.check_output("git rev-parse origin/main", shell=True).decode().strip()
    if head != origin:
        error("HEAD does NOT point to origin/main")
        err = 1

    if err > 0:
        sys.exit(1)

    print(SEPARATOR)


def build():
    print("[[[[[[ Build website with Mkdocs ]]]]]]")
    run(f"mkdocs build")
    success("Built with success")
    print(SEPARATOR)


def patch_js_version(hash: str):
    print("[[[[[[ patch .js/.css imports with hash ]]]]]]")

    rand_h = random.getrandbits(32)
    rand_h = f"{rand_h:08x}"
    
    pattern = re.compile(r"\?v=dev")
    replacement = f"?v={rand_h}.{hash}"

    for root, _, files in os.walk(os.path.join(PROJECT_ROOT_FOLDER, "site")):
        for filename in files:
            if not filename.lower().endswith((".js", ".yaml", ".html")):
                continue

            path = os.path.join(root, filename)

            if not os.path.isfile(path):
                continue

            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = pattern.sub(replacement, content)

            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated: {filename}")

    success("Patch site/ with success")
    print(SEPARATOR)

    
def push(release: bool = False):
    print("[[[[[[ Publish on GitHub ]]]]]]")
    remote = "release" if release else "origin"
    run(f"ghp-import -n -p -f -r {remote} site")
    success(f"Pushed with success on GitHub ({remote})")
    print(SEPARATOR)


# -----------------------------------------
# Main
# -----------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy the website")
    parser.add_argument("--release", action="store_true", help="Deploy a release (default is dev)")
    args = parser.parse_args()

    hash = initialization()
    if args.release:
        os.environ["DEPLOY_ENV"] = "prod"  # the mkdocs hook injects PROD Supabase creds
    build()
    patch_js_version(hash)
    # check_git_repos()
    
    push(release=args.release)
    sys.exit(0)