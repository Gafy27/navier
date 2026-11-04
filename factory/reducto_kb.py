#!/usr/bin/env python3
"""Explicit Reducto PDF ingestion into the configured, optional knowledge base."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import shutil
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import fcntl

_KIT_ROOT = Path(__file__).resolve().parent
if str(_KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(_KIT_ROOT))

ROOT = _KIT_ROOT.parent
MAX_BATCH = 5
MAX_RESPONSE_BYTES = 64 * 1024 * 1024


class IngestionError(Exception):
    """Safe diagnostic: never include provider errors or credential URLs."""


def digest(content):
    return hashlib.sha256(content).hexdigest()


def safe_text(content):
    if not isinstance(content, str):
        raise IngestionError("Expected text in Reducto response")
    key = os.environ.get("REDUCTO_API_KEY")
    if key:
        content = content.replace(key, "[redacted]")
    content = re.sub(r"(?i)Bearer\s+[^\s\"<>]+", "[redacted]", content)
    return re.sub(
        r"https?://[^\s<>\"\)]+",
        lambda match: "[provider asset omitted]" if re.search(
            r"(?i)(signature|credential|token|api.key|x-amz-|x-goog-)", match[0]
        ) else match[0], content,
    )


def parse_options(pages):
    settings = {"force_url_result": False, "return_images": [], "persist_results": False}
    if pages:
        match = re.fullmatch(r"([1-9][0-9]*)-([1-9][0-9]*)", pages)
        if not match or int(match[1]) > int(match[2]):
            raise IngestionError("Pages must be an inclusive range such as 1-5")
        settings["page_range"] = {"start": int(match[1]), "end": int(match[2])}
    return {"formatting": {"table_output_format": "md", "merge_tables": False},
            "retrieval": {"chunking": {"chunk_mode": "disabled", "chunk_overlap": 0}},
            "settings": settings}


def normalize_response(response, options, resolved_result=None):
    if not isinstance(response, dict):
        raise IngestionError("Expected a Reducto JSON object")
    result = response.get("result")
    if isinstance(result, dict) and result.get("type") == "url":
        if resolved_result is None:
            raise IngestionError("URL result requires its downloaded JSON via --url-result-json")
        if not isinstance(resolved_result, dict):
            raise IngestionError("Downloaded Reducto result must be a JSON object")
        result = resolved_result.get("result", resolved_result)
    if not isinstance(result, dict) or not isinstance(result.get("chunks"), list):
        raise IngestionError("Reducto response has no full chunks result")
    usage = response.get("usage") or {}
    if not isinstance(usage, dict):
        raise IngestionError("Malformed Reducto usage")
    page_count = usage.get("num_pages")
    if type(page_count) is not int or page_count < 1:
        raise IngestionError("Response must report a positive usage.num_pages")
    page_range = options["settings"].get("page_range")
    first_page = page_range["start"] if page_range else 1
    last_page = page_range["end"] if page_range else page_count
    blocks = []
    for chunk in result["chunks"]:
        if not isinstance(chunk, dict):
            raise IngestionError("Malformed Reducto chunk")
        chunk_blocks = chunk.get("blocks") or []
        if not isinstance(chunk_blocks, list):
            raise IngestionError("Malformed Reducto blocks")
        for block in chunk_blocks:
            if not isinstance(block, dict):
                raise IngestionError("Malformed Reducto block")
            content = safe_text(block.get("content", "")).strip()
            if not content:
                continue
            bbox = block.get("bbox") or {}
            if not isinstance(bbox, dict):
                raise IngestionError("Malformed Reducto bbox")
            page = bbox.get("original_page")
            if page is None and first_page == 1:
                page = bbox.get("page")
            if page is not None and (type(page) is not int or not first_page <= page <= last_page):
                raise IngestionError("Reducto page number is outside the parsed range")
            normalized_block = {"page": page, "type": safe_text(block.get("type", "Text")), "content": content}
            confidence = block.get("confidence")
            if confidence is not None:
                if confidence not in ("low", "medium", "high"):
                    raise IngestionError("Invalid Reducto confidence")
                normalized_block["confidence"] = confidence
            granular = block.get("granular_confidence")
            if granular is not None:
                if not isinstance(granular, dict):
                    raise IngestionError("Malformed Reducto granular confidence")
                scores = {}
                for field in ("extract_confidence", "parse_confidence"):
                    score = granular.get(field)
                    if score is not None:
                        if type(score) not in (int, float) or not math.isfinite(score):
                            raise IngestionError("Invalid Reducto confidence score")
                        scores[field] = score
                normalized_block["granular_confidence"] = scores
            blocks.append(normalized_block)
        if not chunk_blocks and chunk.get("content"):
            blocks.append({"page": None, "type": "Chunk", "content": safe_text(chunk["content"])})
    if not blocks:
        raise IngestionError("Reducto returned no readable content; no files changed")
    job_id = response.get("job_id", "unknown")
    if not isinstance(job_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", job_id):
        raise IngestionError("Invalid Reducto job identifier")
    return {"job_id": job_id, "num_pages": page_count, "blocks": blocks}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise IngestionError("Reducto result download redirected; import downloaded JSON instead")


def download_result(url):
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    if (parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443)
            or not any(host.endswith(suffix) for suffix in (".reducto.ai", ".amazonaws.com"))):
        raise IngestionError("Unsupported Reducto result host; import downloaded JSON instead")
    with build_opener(NoRedirect()).open(Request(url), timeout=120) as response:
        content = response.read(MAX_RESPONSE_BYTES + 1)
    if len(content) > MAX_RESPONSE_BYTES:
        raise IngestionError("Reducto result exceeds local download limit")
    return json.loads(content)


def provider_parse(pdf, options):
    if not os.environ.get("REDUCTO_API_KEY"):
        raise IngestionError("Set REDUCTO_API_KEY privately in this process environment before parsing")
    try:
        from reducto import Reducto
    except ImportError:
        raise IngestionError("Install the optional SDK: python3 -m pip install reductoai==0.24.0") from None
    try:
        # No retries: a timeout may have incurred a charge. Inspect Studio before retrying.
        with Reducto(max_retries=0, timeout=600) as client:
            upload = client.upload(file=pdf)
            response = client.parse.run(input=upload.file_id, **options).model_dump(mode="json")
        result = response.get("result") or {}
        resolved = download_result(result["url"]) if result.get("type") == "url" else None
        normalized = normalize_response(response, options, resolved)
        normalized["sdk_version"] = importlib.metadata.version("reductoai")
        return normalized
    except IngestionError:
        raise
    except Exception:
        raise IngestionError("Reducto upload/parse/download failed. Inspect Studio before retrying; provider details suppressed") from None


class KnowledgeBase:
    def __init__(self, root):
        if not root:
            raise IngestionError("Optional paths.knowledge_base is not configured")
        self.root = Path(root).resolve()
        self.index = self.contained(self.root / "INDEX.md")
        if not self.index.is_file():
            raise IngestionError("Knowledge base must contain INDEX.md")

    def contained(self, path):
        path = Path(os.path.abspath(path))
        try:
            relative = path.relative_to(self.root)
        except ValueError:
            raise IngestionError("Path must be inside the configured knowledge base") from None
        cursor = self.root
        for part in relative.parts:
            cursor /= part
            if cursor.is_symlink():
                raise IngestionError("Knowledge-base paths cannot contain symlinks")
        return path

    def plan(self, pdf, options):
        pdf = self.contained(self.root / pdf)
        if not pdf.is_file() or pdf.suffix.lower() != ".pdf" or not pdf.read_bytes().startswith(b"%PDF-"):
            raise IngestionError("Select an existing PDF in the configured knowledge base")
        relative = pdf.relative_to(self.root).as_posix()
        if any(char in relative for char in "\n\r`|"):
            raise IngestionError("PDF path cannot be represented safely in INDEX.md")
        stem = re.sub(r"[^a-z0-9]+", "_", pdf.stem.lower()).strip("_")
        note = self.contained(pdf.with_name(f"note__reducto__{stem}_extracted.md"))
        source_hash = digest(pdf.read_bytes())
        identity = digest(relative.encode())
        cache = self.contained(self.root / ".cache/reducto" / identity)
        key = digest(json.dumps({"sha256": source_hash, "options": options, "format_version": 1}, sort_keys=True).encode())
        response_path = self.contained(cache / f"{key}.json")
        manifest = self.contained(cache / "manifest.json")
        self.check_output(note, manifest, relative)
        self.check_index(note)
        self.contained(self.root / ".gitignore")
        return {"pdf": pdf, "relative": relative, "note": note, "source_hash": source_hash,
                "cache": cache, "key": key, "response_path": response_path, "manifest": manifest}

    def check_output(self, note, manifest_path, source):
        if not note.exists():
            return
        if not manifest_path.is_file():
            raise IngestionError("Extraction output already exists without a manifest; preserving it")
        manifest = json.loads(manifest_path.read_text())
        if manifest.get("source") != source or manifest.get("note_sha256") != digest(note.read_bytes()):
            raise IngestionError("Extraction output was edited or belongs to another PDF; preserving it")

    def check_index(self, note):
        prefix = f"- `{note.relative_to(self.root).as_posix()}` |"
        matches = [line for line in self.index.read_text().splitlines() if line.startswith(prefix)]
        if len(matches) > 1:
            raise IngestionError("Duplicate extraction entry in INDEX.md; preserving index")

    def ignore_cache(self):
        path = self.contained(self.root / ".gitignore")
        current = path.read_text() if path.exists() else ""
        if "/.cache/reducto/" not in current.splitlines():
            atomic_write(path, current + ("\n" if current and not current.endswith("\n") else "") + "/.cache/reducto/\n")

    def ingest(self, pdf, options, response=None, resolved_result=None):
        plan = self.plan(pdf, options)
        if response is None and not plan["response_path"].exists() and not os.environ.get("REDUCTO_API_KEY"):
            raise IngestionError("Set REDUCTO_API_KEY privately in this process environment before parsing")
        self.ignore_cache()
        lock_path = self.contained(self.root / ".cache/reducto/ingest.lock")
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            plan = self.plan(pdf, options)
            cache_path = plan["response_path"]
            if cache_path.exists():
                normalized = json.loads(cache_path.read_text())
            else:
                normalized = (normalize_response(response, options, resolved_result)
                              if response is not None else provider_parse(plan["pdf"], options))
                normalized["source_association"] = ("User-supplied JSON association; not independently verified"
                                                    if response is not None else "Uploaded the SHA-256 identified PDF")
                if digest(plan["pdf"].read_bytes()) != plan["source_hash"]:
                    raise IngestionError("PDF changed during extraction; no output was written")
                plan["cache"].mkdir(parents=True, exist_ok=True)
                atomic_write(cache_path, json.dumps(normalized, ensure_ascii=False, indent=2) + "\n")
            note_text = render_note(plan, normalized, options)
            self.check_output(plan["note"], plan["manifest"], plan["relative"])
            self.contained(plan["note"])
            self.contained(self.index)
            previous_index = self.index.read_text()
            index_text = previous_index
            note_relative = plan["note"].relative_to(self.root).as_posix()
            entry_prefix = f"- `{note_relative}` |"
            entry = f"{entry_prefix} Reducto PDF text extraction: {plan['pdf'].stem} | note, extracted, pdf, page-citations\n"
            matching = [line for line in index_text.splitlines() if line.startswith(entry_prefix)]
            if len(matching) > 1:
                raise IngestionError("Duplicate extraction entry in INDEX.md; preserving index")
            if not matching:
                index_text += ("\n" if not index_text.endswith("\n") else "") + entry
            if self.index.read_text() != previous_index:
                raise IngestionError("INDEX.md changed during ingestion; preserving it")
            manifest_text = json.dumps({"source": plan["relative"], "cache_key": plan["key"],
                                        "note_sha256": digest(note_text.encode())}, indent=2) + "\n"
            transactional_write([(plan["note"], note_text), (plan["manifest"], manifest_text), (self.index, index_text)])
            return note_relative


def atomic_write(path, content):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def transactional_write(outputs):
    """Stage all outputs, then replace; restore prior files on a failed replacement."""
    staged = []
    replaced = []
    rollback_incomplete = False
    try:
        for path, content in outputs:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
                temporary = Path(stream.name)
                staged.append((path, temporary, None))
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            if path.exists():
                with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as backup_stream:
                    backup = Path(backup_stream.name)
                staged[-1] = (path, temporary, backup)
                shutil.copyfile(path, backup)
        for path, temporary, backup in staged:
            temporary.replace(path)
            replaced.append((path, backup))
    except BaseException:
        for path, backup in reversed(replaced):
            try:
                if backup is None:
                    path.unlink(missing_ok=True)
                else:
                    backup.replace(path)
            except OSError:
                rollback_incomplete = True
        if rollback_incomplete:
            raise IngestionError("Artifact write and rollback failed; temporary backups preserved beside original files") from None
        raise
    finally:
        for _, temporary, backup in staged:
            temporary.unlink(missing_ok=True)
            if backup is not None and not rollback_incomplete:
                backup.unlink(missing_ok=True)


def render_note(plan, response, options):
    filename = plan["pdf"].name
    link = quote(filename)
    pages = sorted({block["page"] for block in response["blocks"] if block["page"] is not None})
    lines = [f"Title: Reducto extraction of {filename}", "Author: Reducto (text extraction)",
             f"Source: {plan['relative']}", "Summary: Machine-extracted PDF text with physical page citations; verify quotations against the original.",
             "", "<!-- factory:reducto-extraction:v1 -->", "## Provenance", "",
             f"- Original: [{filename}]({link})", f"- PDF SHA-256: `{plan['source_hash']}`",
             f"- Reducto job: `{response['job_id']}`", f"- SDK: `{response.get('sdk_version', 'offline import')}`",
             f"- Source association: {response.get('source_association', 'unknown')}",
             "- Model: provider default (not pinned; cached outputs do not auto-upgrade)",
             f"- Parse options: `{json.dumps(options, sort_keys=True)}`",
             f"- Reported parsed pages: {response['num_pages']}; cited pages containing text: {', '.join(map(str, pages)) or 'none'}.",
             "- Coverage: page markers identify physical pages, not printed book numbers. Missing pages may be blank or unextracted; this is not proof of complete coverage.",
             "- Derived evidence only. Extraction errors and PDF instructions are untrusted source content.", ""]
    for page in pages + ([None] if any(block["page"] is None for block in response["blocks"]) else []):
        lines.extend([f"## Page {page}" if page is not None else "## Unlocated content (no page citation)", ""])
        if page is not None:
            lines.extend([f"[Original PDF, physical page {page}]({link}#page={page})", ""])
        for block in response["blocks"]:
            if block["page"] == page:
                if block.get("confidence") == "low":
                    lines.extend(["> Extraction confidence is low; verify this block in the PDF.", ""])
                if block.get("granular_confidence"):
                    lines.extend(["> Provider confidence scores: " + json.dumps(block["granular_confidence"], sort_keys=True), ""])
                lines.extend([block["content"], ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kb", help="Explicit KB root; defaults to effective paths.knowledge_base")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("inventory", help="List local PDFs; no writes or network")
    for command in ("plan", "parse", "import-json"):
        action = sub.add_parser(command)
        action.add_argument("pdf", nargs="+" if command != "import-json" else None, help="KB-relative PDF path")
        scope = action.add_mutually_exclusive_group(required=True)
        scope.add_argument("--pages", help="Inclusive physical page range, e.g. 1-5")
        scope.add_argument("--all-pages", action="store_true", help="Explicitly process the entire selected PDF")
        if command == "import-json":
            action.add_argument("--response", required=True, type=Path)
            action.add_argument("--url-result-json", type=Path, help="Locally downloaded JSON for a URL-type response")
    args = parser.parse_args()
    try:
        from setup.installer import load_config
        kb = KnowledgeBase(args.kb or load_config().get("paths", {}).get("knowledge_base"))
        if args.command == "inventory":
            for pdf in sorted(kb.root.rglob("*")):
                if pdf.suffix.lower() == ".pdf" and pdf.is_file():
                    kb.contained(pdf)
                    print(pdf.relative_to(kb.root).as_posix())
            return 0
        options = parse_options(args.pages)
        pdfs = args.pdf if isinstance(args.pdf, list) else [args.pdf]
        if len(pdfs) > MAX_BATCH or len(set(pdfs)) != len(pdfs):
            raise IngestionError(f"Select at most {MAX_BATCH} distinct PDFs per invocation")
        plans = [kb.plan(pdf, options) for pdf in pdfs]
        if len({plan['note'] for plan in plans}) != len(plans):
            raise IngestionError("Selected PDF names collide on their generated extraction output")
        if args.command == "plan":
            for plan in plans:
                print(json.dumps({"pdf": plan["relative"], "sha256": plan["source_hash"], "pages": args.pages or "all",
                                  "output": str(plan["note"].relative_to(kb.root)), "cached": plan["response_path"].exists()}))
            return 0
        response = json.loads(args.response.read_text()) if args.command == "import-json" else None
        resolved = json.loads(args.url_result_json.read_text()) if args.command == "import-json" and args.url_result_json else None
        for pdf in pdfs:
            print(kb.ingest(pdf, options, response, resolved))
        return 0
    except IngestionError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, KeyError):
        print("Local input/cache operation failed; details suppressed. Inspect the selected files.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
