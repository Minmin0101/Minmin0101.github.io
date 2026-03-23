from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_JSON_PATH = ROOT / "content.json"
BLOG_INDEX_PATH = ROOT / "blog" / "index.html"
MARKDOWN_DIR = ROOT / "markdown-posts"
LOCAL_TZ = timezone(timedelta(hours=8))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def normalize_path(value: str) -> str:
    return value.strip("/").replace("\\", "/")


def parse_local_datetime(value: str) -> datetime:
    text = value.strip().replace("T", " ")
    if text.endswith("Z"):
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(LOCAL_TZ)
    return datetime.fromisoformat(text).replace(tzinfo=LOCAL_TZ)


def yaml_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def compress_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def shorten_text(value: str, limit: int) -> str:
    value = compress_spaces(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def extract_cover_map() -> dict[str, tuple[str | None, str | None]]:
    blog_html = read_text(BLOG_INDEX_PATH)
    start_marker = '<ul class="post-list rich-post-list" id="post-list-start">'
    end_marker = "</ul></div><footer"
    start_index = blog_html.find(start_marker)
    end_index = blog_html.find(end_marker, start_index)
    if start_index == -1 or end_index == -1:
        return {}
    segment = blog_html[start_index + len(start_marker) : end_index]

    cover_map: dict[str, tuple[str | None, str | None]] = {}
    for item in re.findall(r'(<li class="post-list-item fade".*?</article></li>)', segment, flags=re.S):
        href_match = re.search(
            r'<a[^>]*class="post-title-link"[^>]*href="(/[^"]+/)"|<a[^>]*href="(/[^"]+/)"[^>]*class="post-title-link"',
            item,
        )
        if not href_match:
            continue
        path = normalize_path(href_match.group(1) or href_match.group(2))
        image_match = re.search(r'<img class="post-cover-media" src="([^"]+)" alt="([^"]*)"', item)
        if image_match:
            cover_map[path] = (image_match.group(1), image_match.group(2).strip() or None)
        else:
            cover_map[path] = (None, None)
    return cover_map


def extract_updated_and_body(article_path: str) -> tuple[str | None, str]:
    html_path = ROOT / article_path / "index.html"
    html = read_text(html_path)

    updated_match = re.search(r'itemprop="dateUpdated">([^<]+)</time>|<meta property="article:modified_time" content="([^"]+)">', html)
    updated = None
    if updated_match:
        updated = updated_match.group(2) or updated_match.group(1)

    start_marker = '<div class="post-content" id="post-content" itemprop="postContent">'
    end_marker = '</div><blockquote class="post-copyright">'
    start_index = html.find(start_marker)
    end_index = html.find(end_marker, start_index)
    if start_index == -1 or end_index == -1:
        raise RuntimeError(f"Could not extract post body from {html_path}")
    body = html[start_index + len(start_marker) : end_index].strip()
    body = body.replace('<span id="more"></span>', "\n<!-- more -->\n")
    return updated, body


def build_markdown_document(item: dict, cover_map: dict[str, tuple[str | None, str | None]]) -> tuple[str, str]:
    path = normalize_path(str(item["path"]))
    slug = Path(path).name
    date_local = parse_local_datetime(str(item["date"]))
    updated_raw, body_html = extract_updated_and_body(path)
    updated_local = parse_local_datetime(updated_raw) if updated_raw else date_local
    cover, cover_alt = cover_map.get(path, (None, None))

    tags: list[str] = []
    for tag in item.get("tags", []):
        if isinstance(tag, dict):
            value = str(tag.get("name", "")).strip()
        else:
            value = str(tag).strip()
        if value:
            tags.append(value)

    summary = shorten_text(str(item.get("text", "")).strip(), 120)
    filename = f"{date_local.strftime('%Y-%m-%d')}-{slug}.md"
    front_matter = [
        "---",
        f"title: {yaml_quote(str(item['title']).strip())}",
        f"date: {date_local.strftime('%Y-%m-%d %H:%M:%S')}",
        f"updated: {updated_local.strftime('%Y-%m-%d %H:%M:%S')}",
        f"slug: {slug}",
        f"path: {path}",
        f"summary: {yaml_quote(summary)}",
        "tags:",
    ]
    for tag in tags:
        front_matter.append(f"  - {tag}")
    if cover:
        front_matter.append(f"cover: {cover}")
    if cover_alt:
        front_matter.append(f"cover_alt: {yaml_quote(cover_alt)}")
    front_matter.extend(
        [
            "body_format: html",
            f"template_path: {path}/index.html",
            "---",
            "",
            body_html,
            "",
        ]
    )
    return filename, "\n".join(front_matter)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export existing HTML posts to markdown-posts sources.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing markdown files if they already exist.")
    args = parser.parse_args()

    data = json.loads(read_text(CONTENT_JSON_PATH))
    posts = data.get("posts", [])
    cover_map = extract_cover_map()
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)

    exported = 0
    skipped = 0
    for item in posts:
        filename, content = build_markdown_document(item, cover_map)
        output_path = MARKDOWN_DIR / filename
        if output_path.exists() and not args.overwrite:
            skipped += 1
            continue
        output_path.write_text(content, encoding="utf-8", newline="\n")
        exported += 1

    print(f"Exported {exported} legacy post(s), skipped {skipped}.")


if __name__ == "__main__":
    main()
