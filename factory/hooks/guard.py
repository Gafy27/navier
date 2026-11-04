#!/usr/bin/env python3
"""Enforce factory/config.yaml permissions on shell commands.

A matching block beats ask, which beats allow. Unmatched commands follow
permissions.ceiling. Edits to secret files are always blocked. Cursor receives
permission allow, ask, or deny. Claude cannot ask, so ask becomes a block.
"""

from __future__ import annotations

import json
import shlex
import sys
from pathlib import Path

import yaml

SECRET_NAMES = (".env", "credentials.json", "id_rsa", "id_ed25519")
PATH_KEYS = {
    "file_path",
    "filePath",
    "path",
    "target_file",
    "target_notebook",
    "notebook_path",
}
RANK = {"allow": 0, "ask": 1, "block": 2}
READ_CMDS = {
    "ls",
    "pwd",
    "rg",
    "grep",
    "egrep",
    "fgrep",
    "zgrep",
    "bzgrep",
    "xzgrep",
    "multigrep",
    "sed",
    "awk",
    "cd",
    "cat",
    "head",
    "tail",
    "wc",
}
GIT_READ = {"status", "diff", "log", "show"}
CARGO_BUILD = {"build", "check", "test", "clippy", "fmt", "tree", "run"}
KIT = Path(__file__).resolve().parent.parent


def command_of(data: dict) -> str:
    command = data.get("command")
    if isinstance(command, str):
        return command
    tool_input = data.get("tool_input") or data.get("toolInput") or {}
    if isinstance(tool_input, dict):
        inner = tool_input.get("command") or tool_input.get("cmd")
        if isinstance(inner, str):
            return inner
    return ""


def collect_paths(obj: object, out: list[str], depth: int = 0) -> None:
    if depth > 4:
        return
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in PATH_KEYS and isinstance(value, str):
                out.append(value)
            elif key in {"file_paths", "paths"} and isinstance(value, list):
                out.extend(item for item in value if isinstance(item, str))
            else:
                collect_paths(value, out, depth + 1)
    elif isinstance(obj, list):
        for item in obj[:30]:
            collect_paths(item, out, depth + 1)


def secret_reason(data: dict) -> str | None:
    paths: list[str] = []
    collect_paths(data, paths)
    for path in paths:
        cleaned = path.replace("\\", "/").removeprefix("./")
        name = cleaned.rsplit("/", 1)[-1]
        if cleaned == ".git" or cleaned.startswith(".git/") or "/.git/" in f"/{cleaned}":
            return f"editing {path} is blocked by factory/hooks/guard.py"
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            return f"editing {path} is blocked by factory/hooks/guard.py"
        if name in SECRET_NAMES or name.endswith(".pem"):
            return f"editing {path} is blocked by factory/hooks/guard.py"
    return None


def load_policy() -> dict:
    base = yaml.safe_load((KIT / "config.yaml").read_text()) or {}
    perms = dict(base.get("permissions") or {})
    local_path = KIT / "config.local.yaml"
    if not local_path.is_file():
        return perms
    local = yaml.safe_load(local_path.read_text()) or {}
    overlay = local.get("permissions") or {}
    if "ceiling" in overlay:
        perms["ceiling"] = overlay["ceiling"]
    by_id = {rule["id"]: rule for rule in perms.get("rules") or [] if "id" in rule}
    for rule in overlay.get("rules") or []:
        if "id" in rule:
            by_id[rule["id"]] = rule
    perms["rules"] = list(by_id.values())
    return perms


def normalize(argv: list[str]) -> list[str]:
    if not argv:
        return argv
    argv = list(argv)
    if len(argv) >= 4 and argv[0] == "git" and argv[1] == "-C":
        argv = ["git", *argv[3:]]
    # `cargo +stable fmt` (and other toolchains): policy matches on the subcommand.
    if len(argv) >= 3 and argv[0] == "cargo" and argv[1].startswith("+") and len(argv[1]) > 1:
        argv = ["cargo", *argv[2:]]
    head = argv[0].replace("\\", "/")
    if "/" in head:
        argv[0] = head.rsplit("/", 1)[-1]
    # `head; cat` (no space before ';') tokenizes as argv[0] == "head;"
    argv[0] = argv[0].rstrip(";")
    return argv


def match_prefix(argv: list[str], prefix: list) -> bool:
    if len(argv) < len(prefix):
        return False
    for index, token in enumerate(prefix):
        if isinstance(token, list):
            if argv[index] not in [str(item) for item in token]:
                return False
        elif argv[index] != str(token):
            return False
    return True


def classify(argv: list[str]) -> str:
    argv = normalize(argv)
    if not argv:
        return "empty"
    head = argv[0]
    if head in READ_CMDS:
        return "read"
    if head == "git" and len(argv) > 1 and argv[1] in GIT_READ:
        return "read"
    if head == "git" and len(argv) > 1 and argv[1] == "grep":
        return "read"
    if head in {"rustfmt", "rustc"}:
        return "build"
    if head == "cargo" and len(argv) > 1 and argv[1] in CARGO_BUILD:
        return "build"
    return "other"


def ceiling_decision(argv: list[str], ceiling: str) -> str:
    kind = classify(argv)
    if ceiling == "off":
        return "block"
    if ceiling == "low":
        return "allow" if kind == "read" else "block"
    if ceiling == "medium":
        return "allow" if kind in {"read", "build"} else "ask"
    if ceiling == "allow":
        return "allow"
    return "ask"


def decide_argv(argv: list[str], policy: dict) -> tuple[str, str]:
    matches = []
    for rule in policy.get("rules") or []:
        if rule.get("enabled", True) is False:
            continue
        prefix = rule.get("prefix")
        if not isinstance(prefix, list) or not prefix:
            continue
        if match_prefix(normalize(argv), prefix):
            matches.append(rule)
    if matches:
        winner = max(matches, key=lambda rule: RANK.get(str(rule.get("decision")), 1))
        decision = str(winner.get("decision"))
        if decision not in RANK:
            decision = "ask"
        reason = str(winner.get("reason") or winner.get("id"))
        return decision, reason
    ceiling = str(policy.get("ceiling") or "medium")
    return ceiling_decision(argv, ceiling), f"no permission rule matched ({ceiling})"


def split_command(command: str) -> list[list[str]] | None:
    if "$(" in command or "`" in command:
        return None
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return None
    parts: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in {"&&", "||", ";", "|"}:
            if current:
                parts.append(current)
            current = []
        else:
            current.append(token)
    if current:
        parts.append(current)
    return parts


def decide_command(command: str, policy: dict) -> tuple[str, str]:
    parts = split_command(command)
    if parts is None:
        ceiling = str(policy.get("ceiling") or "medium")
        if ceiling == "allow":
            return "allow", "unparseable command (ceiling allow)"
        if ceiling == "off":
            return "block", "command could not be parsed"
        return "ask", "command could not be parsed"
    decision, reason = "allow", ""
    for argv in parts:
        part_decision, part_reason = decide_argv(argv, policy)
        if RANK[part_decision] > RANK[decision]:
            decision, reason = part_decision, part_reason
    return decision, reason


def claude_host(data: dict) -> bool:
    name = str(data.get("hook_event_name") or data.get("hookEventName") or "")
    return name[:1].isupper()


def emit(decision: str, reason: str, data: dict) -> int:
    if decision == "allow":
        print(json.dumps({"permission": "allow"}))
        return 0
    if decision == "ask" and not claude_host(data):
        print(json.dumps({
            "permission": "ask",
            "user_message": reason,
            "agent_message": reason,
        }))
        return 0
    if decision == "ask":
        reason = f"{reason}. This host cannot ask, so the command is blocked."
    print(json.dumps({
        "permission": "deny",
        "user_message": reason,
        "agent_message": reason,
    }))
    print(reason, file=sys.stderr)
    return 2


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return emit("allow", "", {})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return emit("allow", "", {})
    if not isinstance(data, dict):
        return emit("allow", "", {})
    secret = secret_reason(data)
    if secret:
        return emit("block", secret, data)
    command = command_of(data).strip()
    if not command:
        return emit("allow", "", data)
    try:
        policy = load_policy()
    except (OSError, yaml.YAMLError) as exc:
        return emit("block", f"permissions failed to load: {exc}", data)
    decision, reason = decide_command(command, policy)
    return emit(decision, reason, data)


def self_check() -> None:
    policy = load_policy()
    assert decide_command("git push origin main", policy)[0] == "block"
    assert decide_command("git -C /tmp/repo push", policy)[0] == "block"
    assert decide_command("echo ok && git push", policy)[0] == "block"
    assert decide_command("cargo test -p cosmos-batch", policy)[0] == "allow"
    assert decide_command("cargo +stable fmt -- --check", policy)[0] == "allow"
    assert decide_command("rustfmt --check README.md", policy)[0] == "allow"
    assert decide_command("git status", policy)[0] == "allow"
    assert decide_command("git commit -m 'wip'", policy)[0] == "allow"
    assert decide_command("curl https://example.com", policy)[0] == "allow"
    assert decide_command("rm -rf /tmp/not-a-real-path", policy)[0] == "allow"
    assert decide_command("grep -r foo .", policy)[0] == "allow"
    assert decide_command("/usr/bin/grep -n bar README.md", policy)[0] == "allow"
    assert decide_command("git grep -n pattern", policy)[0] == "allow"
    assert decide_command("multigrep a b c", policy)[0] == "allow"
    assert decide_command("sed -n '10,20p' README.md", policy)[0] == "allow"
    assert decide_command("/usr/bin/sed -n 1p README.md", policy)[0] == "allow"
    assert (
        decide_command(
            "cd /tmp && grep -n '^#' README.md | head -80",
            policy,
        )[0]
        == "allow"
    )
    assert (
        decide_command(
            "cd /tmp && head -60 foo.rs; grep -n POSTGRES -r crates; cat bar.rs | head -120",
            policy,
        )[0]
        == "allow"
    )
    assert decide_command("cd /tmp && mkdir -p foo/bar", policy)[0] == "allow"
    assert decide_command("mkdir -p /tmp/cosmos-test", policy)[0] == "allow"
    assert decide_command("cat README.md", policy)[0] == "allow"
    assert decide_command("/usr/bin/cat README.md", policy)[0] == "allow"
    assert decide_command("find . -name '*.rs'", policy)[0] == "allow"
    assert decide_command("python /tmp/edit.py", policy)[0] == "allow"
    assert split_command("echo $(whoami)") is None
    assert decide_command("echo $(whoami)", policy)[0] == "allow"
    assert (
        decide_command(
            "python3 -B /tmp/rx/find.py crates,obsidian foo,bar .md",
            policy,
        )[0]
        == "allow"
    )
    assert decide_command("rm -rf /", policy)[0] == "allow"
    low = {"ceiling": "low", "rules": []}
    assert decide_command("ls", low)[0] == "allow"
    assert decide_command("cargo test", low)[0] == "block"
    off = {"ceiling": "off", "rules": policy["rules"]}
    assert decide_command("git push", off)[0] == "block"
    assert decide_command("curl x", off)[0] == "block"
    assert secret_reason({"file_path": "crates/foo/.env"})
    assert secret_reason({"tool_input": {"file_path": ".env.example"}}) is None
    assert secret_reason({"path": ".git/config"})
    merged = {
        "ceiling": "high",
        "rules": [{"id": "git-push", "decision": "allow", "prefix": ["git", "push"]}],
    }
    assert decide_command("git push", merged)[0] == "allow"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--self-check":
        self_check()
        print("guard ok")
    else:
        sys.exit(main())
