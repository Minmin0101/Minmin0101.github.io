from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from html import escape, unescape
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

try:
    import markdown as markdown_lib
    import yaml
except ImportError as exc:
    missing = str(exc).split()[-1].strip("'")
    print(
        "Missing dependency:",
        missing,
        "\nRun: py -3 -m pip install -r tools\\requirements-posts.txt",
        file=sys.stderr,
    )
    raise SystemExit(1)


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_DIR = ROOT / "markdown-posts"
MANIFEST_PATH = MARKDOWN_DIR / "manifest.json"

BLOG_INDEX_PATH = ROOT / "blog" / "index.html"
ARCHIVES_INDEX_PATH = ROOT / "archives" / "index.html"
TAGS_INDEX_PATH = ROOT / "tags" / "index.html"
TAG_TEMPLATE_PATH = ROOT / "tags" / "生活" / "index.html"
ARTICLE_TEMPLATE_PATH = ROOT / "2026" / "01" / "23" / "hello-world" / "index.html"
CONTENT_JSON_PATH = ROOT / "content.json"
RSS_PATH = ROOT / "rss2.xml"
SITEMAP_XML_PATH = ROOT / "sitemap.xml"
SITEMAP_TXT_PATH = ROOT / "sitemap.txt"
BAIDU_SITEMAP_XML_PATH = ROOT / "baidusitemap.xml"
README_PATH = ROOT / "README.md"

LOCAL_TZ = timezone(timedelta(hours=8))
CANVAS_TONES = ("tone-a", "tone-b", "tone-c", "tone-d")


@dataclass
class SiteConfig:
    site_name: str
    site_description: str
    site_url: str
    author_name: str


@dataclass
class PostRecord:
    title: str
    path: str
    date_local: datetime
    updated_local: datetime
    tags: list[str]
    text: str
    summary: str
    html_content: str
    source: str
    slug: str
    cover: str | None
    cover_alt: str | None
    source_file: str | None
    template_path: str | None = None

    @property
    def url_path(self) -> str:
        return "/" + self.path.strip("/") + "/"

    @property
    def url(self) -> str:
        return SITE.site_url.rstrip("/") + self.url_path

    @property
    def word_count(self) -> int:
        return len(re.sub(r"\s+", "", self.text))

    @property
    def reading_minutes(self) -> int:
        return max(1, math.ceil(self.word_count / 400))

    @property
    def post_id(self) -> str:
        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", self.slug).strip("-")
        return slug or "markdown-post"

    @property
    def iso_published(self) -> str:
        return to_iso_utc(self.date_local)

    @property
    def iso_updated(self) -> str:
        return to_iso_utc(self.updated_local)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def replace_one(text: str, pattern: str, repl: str, *, flags: int = 0, label: str) -> str:
    new_text, count = re.subn(pattern, lambda _match: repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Could not update {label}")
    return new_text


def strip_html(value: str) -> str:
    value = re.sub(r"<script.*?</script>", "", value, flags=re.S)
    value = re.sub(r"<style.*?</style>", "", value, flags=re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def compress_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def shorten_text(value: str, limit: int) -> str:
    value = compress_spaces(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def unescape_html_deep(value: str, *, rounds: int = 3) -> str:
    result = value
    for _ in range(rounds):
        unescaped = unescape(result)
        if unescaped == result:
            break
        result = unescaped
    return result


def normalize_summary(value: str, *, limit: int = 120) -> str:
    cleaned = unescape_html_deep(value)
    cleaned = strip_html(cleaned)
    cleaned = compress_spaces(cleaned)
    return shorten_text(cleaned, limit)


def parse_local_datetime(value: object | None, fallback: datetime | None = None) -> datetime:
    if value in (None, ""):
        return fallback or datetime.now(LOCAL_TZ)

    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip().replace("T", " ").replace("/", "-")
        if text.endswith("Z"):
            dt = datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(LOCAL_TZ)
            return dt
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        else:
            dt = datetime.fromisoformat(text)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=LOCAL_TZ)
    return dt.astimezone(LOCAL_TZ)


def to_iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def to_rss_date(value: datetime) -> str:
    return format_datetime(value.astimezone(timezone.utc))


def format_day(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def format_title_time(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def format_month_day(value: datetime) -> str:
    return value.strftime("%m-%d")


def format_word_count(value: int) -> str:
    if value >= 1000:
        compact = f"{value / 1000:.1f}".rstrip("0").rstrip(".")
        return f"{compact}k 字"
    return f"{value} 字"


def normalize_path(value: str) -> str:
    return value.strip("/").replace("\\", "/")


def tag_href(tag: str) -> str:
    return f"/tags/{quote(tag)}/"


def article_url_from_path(path: str) -> str:
    return SITE.site_url.rstrip("/") + "/" + normalize_path(path) + "/"


def read_head_text(path: Path) -> str | None:
    try:
        relative_path = path.relative_to(ROOT).as_posix()
    except ValueError:
        return None
    result = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"HEAD:{relative_path}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def read_template_text(path: Path) -> str:
    return read_head_text(path) or read_text(path)


def extract_site_config() -> SiteConfig:
    root_index = read_text(ROOT / "index.html")
    site_name_match = re.search(r"<meta property=\"og:site_name\" content=\"([^\"]+)\">", root_index)
    description_match = re.search(r"<meta name=\"description\" content=\"([^\"]+)\">", root_index)
    url_match = re.search(r"<meta property=\"og:url\" content=\"(https://[^\"]+)\">", root_index)
    author_match = re.search(r"<meta property=\"article:author\" content=\"([^\"]+)\">", root_index)

    site_name = site_name_match.group(1) if site_name_match else "My Blog"
    description = description_match.group(1) if description_match else ""
    site_url = url_match.group(1).rsplit("/", 1)[0] if url_match else "https://example.com"
    author = author_match.group(1) if author_match else site_name
    return SiteConfig(site_name=site_name, site_description=description, site_url=site_url, author_name=author)


SITE = extract_site_config()


def load_previous_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        return json.loads(read_text(MANIFEST_PATH))
    except json.JSONDecodeError:
        return []


def parse_front_matter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---"):
        return {}, raw
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, flags=re.S)
    if not match:
        return {}, raw
    front_matter = yaml.safe_load(match.group(1)) or {}
    body = match.group(2)
    return front_matter, body


def remove_matching_first_heading(html_content: str, title: str) -> str:
    pattern = re.compile(
        r"^\s*<h1[^>]*>\s*" + re.escape(escape(title)) + r"\s*</h1>\s*",
        flags=re.I | re.S,
    )
    return pattern.sub("", html_content, count=1)


def render_markdown(body: str, title: str) -> str:
    rendered = markdown_lib.markdown(
        body,
        extensions=["extra", "fenced_code", "tables", "toc", "sane_lists"],
        output_format="html5",
    )
    return remove_matching_first_heading(rendered, title)


def build_post_toc_html(html_content: str) -> str:
    heading_pattern = re.compile(r"<h([2-6]) id=\"([^\"]+)\"[^>]*>(.*?)</h\1>", flags=re.S)
    headings: list[dict[str, object]] = []
    counters = {level: 0 for level in range(2, 7)}

    for level_text, heading_id, inner_html in heading_pattern.findall(html_content):
        level = int(level_text)
        counters[level] += 1
        for reset_level in range(level + 1, 7):
            counters[reset_level] = 0
        number = ".".join(str(counters[index]) for index in range(2, level + 1) if counters[index]) + "."
        heading_text = strip_html(re.sub(r"<a class=\"headerlink\".*?</a>", "", inner_html, flags=re.S))
        headings.append(
            {
                "level": level,
                "id": heading_id,
                "text": heading_text,
                "number": number,
                "children": [],
            }
        )

    if not headings:
        return '<nav class="post-toc-wrap fade" id="post-toc"><ol class="post-toc"></ol></nav>'

    root: dict[str, object] = {"level": 1, "children": []}
    stack: list[dict[str, object]] = [root]
    for heading in headings:
        while stack and int(stack[-1]["level"]) >= int(heading["level"]):
            stack.pop()
        stack[-1]["children"].append(heading)
        stack.append(heading)

    def render_nodes(nodes: list[dict[str, object]], *, child: bool = False) -> str:
        list_class = "post-toc-child" if child else "post-toc"
        parts = [f'<ol class="{list_class}">']
        for node in nodes:
            parts.append(
                f'<li class="post-toc-item post-toc-level-{node["level"]}">'
                f'<a class="post-toc-link" href="#{escape(str(node["id"]))}">'
                f'<span class="post-toc-number">{escape(str(node["number"]))}</span> '
                f'<span class="post-toc-text">{escape(str(node["text"]))}</span>'
                "</a>"
            )
            children = node["children"]
            if children:
                parts.append(render_nodes(children, child=True))
            parts.append("</li>")
        parts.append("</ol>")
        return "".join(parts)

    return f'<nav class="post-toc-wrap fade" id="post-toc">{render_nodes(root["children"])}</nav>'


def listify_tags(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, (list, tuple)):
        result: list[str] = []
        for item in value:
            item_text = str(item).strip()
            if item_text:
                result.append(item_text)
        return result
    return [str(value).strip()]


def build_markdown_posts(previous_generated_paths: set[str], legacy_paths: set[str]) -> list[PostRecord]:
    posts: list[PostRecord] = []
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)

    for markdown_path in sorted(MARKDOWN_DIR.glob("*.md")):
        if markdown_path.name.startswith("_"):
            continue

        raw = read_text(markdown_path)
        front_matter, body = parse_front_matter(raw)
        if front_matter.get("draft") is True:
            continue

        title = str(front_matter.get("title") or markdown_path.stem).strip()
        if not title:
            raise RuntimeError(f"Missing title in {markdown_path.name}")

        date_local = parse_local_datetime(front_matter.get("date"))
        updated_local = parse_local_datetime(front_matter.get("updated"), fallback=date_local)
        slug = str(front_matter.get("slug") or markdown_path.stem).strip()
        if not slug:
            raise RuntimeError(f"Missing slug in {markdown_path.name}")

        custom_path = str(front_matter.get("path") or "").strip()
        path = normalize_path(custom_path or f"{date_local.strftime('%Y/%m/%d')}/{slug}")
        if path in legacy_paths and not custom_path:
            raise RuntimeError(
                f"Markdown post path conflict: {path} already exists as an old article. "
                f"Please change the date or slug in {markdown_path.name}, or add path: {path} to confirm replacing it."
            )

        body_format = str(front_matter.get("body_format") or "markdown").strip().lower()
        excerpt_source = body.split("<!-- more -->", 1)[0]
        if body_format == "html":
            html_content = body.strip()
            plain_text = strip_html(html_content)
            excerpt_html = excerpt_source.strip()
        else:
            html_content = render_markdown(body, title)
            plain_text = strip_html(html_content)
            excerpt_html = render_markdown(excerpt_source, title)
        summary_source = str(front_matter.get("summary") or "").strip() or strip_html(excerpt_html) or plain_text
        summary = normalize_summary(summary_source)

        cover = str(front_matter.get("cover") or "").strip() or None
        cover_alt = str(front_matter.get("cover_alt") or "").strip() or title
        tags = listify_tags(front_matter.get("tags"))
        template_path = str(front_matter.get("template_path") or "").strip() or None
        if template_path:
            template_path = normalize_path(template_path)
        posts.append(
            PostRecord(
                title=title,
                path=path,
                date_local=date_local,
                updated_local=updated_local,
                tags=tags,
                text=plain_text,
                summary=summary,
                html_content=html_content,
                source="markdown",
                slug=slug,
                cover=cover,
                cover_alt=cover_alt,
                source_file=str(markdown_path.relative_to(ROOT)).replace("\\", "/"),
                template_path=template_path,
            )
        )

    current_paths = {post.path for post in posts}
    stale_paths = previous_generated_paths - current_paths
    for stale_path in stale_paths:
        stale_dir = ROOT / normalize_path(stale_path)
        if stale_dir.exists() and stale_dir.is_dir():
            shutil.rmtree(stale_dir, ignore_errors=True)

    return sorted(posts, key=lambda item: item.date_local, reverse=True)


def build_legacy_posts(previous_generated_paths: set[str]) -> list[PostRecord]:
    data = json.loads(read_text(CONTENT_JSON_PATH))
    posts: list[PostRecord] = []
    for item in data.get("posts", []):
        path = normalize_path(item.get("path", ""))
        if not path or path in previous_generated_paths:
            continue
        tags = []
        for tag in item.get("tags", []):
            if isinstance(tag, dict):
                value = str(tag.get("name", "")).strip()
            else:
                value = str(tag).strip()
            if value:
                tags.append(value)
        text = compress_spaces(str(item.get("text", "")))
        date_local = parse_local_datetime(item.get("date"))
        posts.append(
            PostRecord(
                title=str(item.get("title", "")).strip(),
                path=path,
                date_local=date_local,
                updated_local=date_local,
                tags=tags,
                text=text,
                summary=shorten_text(text, 96),
                html_content="",
                source="legacy",
                slug=Path(path).parts[-1],
                cover=None,
                cover_alt=None,
                source_file=None,
            )
        )
    return sorted(posts, key=lambda item: item.date_local, reverse=True)


def build_generated_manifest(posts: Iterable[PostRecord]) -> list[dict]:
    return [
        {
            "title": post.title,
            "path": post.path,
            "date": post.iso_published,
            "tags": post.tags,
            "source_file": post.source_file,
        }
        for post in posts
    ]


def legacy_post_cards() -> dict[str, str]:
    blog_html = read_template_text(BLOG_INDEX_PATH)
    start_marker = '<ul class="post-list rich-post-list" id="post-list-start">'
    end_marker = "</ul></div><footer"
    start_index = blog_html.find(start_marker)
    if start_index == -1:
        return {}
    end_index = blog_html.find(end_marker, start_index)
    if end_index == -1:
        return {}
    list_html = blog_html[start_index + len(start_marker) : end_index]

    cards: dict[str, str] = {}
    for item in re.findall(r'(<li class="post-list-item fade".*?</article></li>)', list_html, flags=re.S):
        if "data-generated-post=\"1\"" in item:
            continue
        href_match = re.search(
            r'<a[^>]*class="post-title-link"[^>]*href="(/[^"]+/)"|<a[^>]*href="(/[^"]+/)"[^>]*class="post-title-link"',
            item,
        )
        if not href_match:
            continue
        path = normalize_path(href_match.group(1) or href_match.group(2))
        cards[path] = item
    return cards


def render_post_tags(tags: list[str], *, with_rel: bool = False, itemprop: bool = False) -> str:
    attrs = ' rel="tag"' if with_rel else ""
    wrapper_attr = ' itemprop="keywords"' if itemprop else ""
    items = []
    for tag in tags:
        items.append(
            f'<li class="article-tag-list-item"><a class="article-tag-list-link" href="{tag_href(tag)}"{attrs}>{escape(tag)}</a></li>'
        )
    return f'<ul class="article-tag-list"{wrapper_attr}>{"".join(items)}</ul>'


def render_generated_card(post: PostRecord, tone: str) -> str:
    if post.cover:
        cover_html = (
            '<div class="post-cover" aria-hidden="true">'
            f'<img class="post-cover-media" src="{escape(post.cover)}" alt="{escape(post.cover_alt or post.title)}" '
            'loading="lazy" decoding="async"></div>'
        )
    else:
        cover_html = (
            '<div class="post-cover" aria-hidden="true">'
            f'<canvas class="canvas-cover" data-post-id="{escape(post.post_id)}" data-tone="{tone}"></canvas>'
            '</div>'
        )

    return (
        f'<li class="post-list-item fade" data-generated-post="1"><article class="article-card article-type-post '
        f'author-post-card {tone}" itemprop="blogPost">{cover_html}'
        f'<h3 class="post-title"><a href="{post.url_path}" class="post-title-link">{escape(post.title)}</a></h3>'
        '<div class="post-meta"><div class="post-meta-info">'
        f'<span><i class="icon icon-calendar"></i>{format_day(post.date_local)}</span> '
        f'<span><i class="icon icon-clock-o"></i>{post.reading_minutes} 分钟阅读</span> '
        f'<span><i class="icon icon-file-text-o"></i>{format_word_count(post.word_count)}</span>'
        '</div></div>'
        f'<div class="post-content"><p>{escape(post.summary)}</p><div class="post-more-wrapper">'
        f'<a href="{post.url_path}" class="post-more">阅读全文 <span>»</span></a></div></div>'
        f'<div class="post-footer">{render_post_tags(post.tags)}</div></article></li>'
    )


def render_latest_item(post: PostRecord) -> str:
    return (
        '<li class="latest-posts-item">'
        f'<a class="latest-posts-link" href="{post.url_path}">'
        f'<time datetime="{post.iso_published}">{post.date_local.strftime("%m-%d")}</time> '
        f'<span>{escape(post.title)}</span></a></li>'
    )


def update_blog_index(all_posts: list[PostRecord]) -> None:
    html = read_template_text(BLOG_INDEX_PATH)
    legacy_cards = legacy_post_cards()
    card_html: list[str] = []
    for index, post in enumerate(all_posts):
        if post.source == "legacy" and post.path in legacy_cards:
            card_html.append(legacy_cards[post.path])
        else:
            card_html.append(render_generated_card(post, CANVAS_TONES[index % len(CANVAS_TONES)]))

    latest_html = "".join(render_latest_item(post) for post in all_posts[:8])
    html = replace_one(
        html,
        r"<ol class=\"latest-posts-list\">.*?</ol>",
        f"<ol class=\"latest-posts-list\">{latest_html}</ol>",
        flags=re.S,
        label="blog latest posts",
    )
    html = replace_one(
        html,
        r"<div class=\"post-count-custom\">.*?</div>",
        f'<div class="post-count-custom">目前共收录 {len(all_posts)} 篇文章</div>',
        flags=re.S,
        label="blog post count",
    )
    html = replace_one(
        html,
        r"<ul class=\"post-list rich-post-list\" id=\"post-list-start\">.*?</ul></div><footer",
        f'<ul class="post-list rich-post-list" id="post-list-start">{"".join(card_html)}</ul></div><footer',
        flags=re.S,
        label="blog post list",
    )
    write_text(BLOG_INDEX_PATH, html)


def group_posts_by_year_month(posts: list[PostRecord]) -> dict[int, dict[int, list[PostRecord]]]:
    grouped: dict[int, dict[int, list[PostRecord]]] = defaultdict(lambda: defaultdict(list))
    for post in posts:
        grouped[post.date_local.year][post.date_local.month].append(post)
    return grouped


def render_archive_tree(posts: list[PostRecord]) -> str:
    grouped = group_posts_by_year_month(posts)
    year_blocks: list[str] = []
    for year in sorted(grouped.keys(), reverse=True):
        months = grouped[year]
        month_blocks: list[str] = []
        year_count = sum(len(items) for items in months.values())
        for month in sorted(months.keys(), reverse=True):
            month_posts = sorted(months[month], key=lambda item: item.date_local, reverse=True)
            post_items = []
            for post in month_posts:
                post_items.append(
                    '<li class="archive-tree-post">'
                    f'<time class="archive-tree-post-date" datetime="{post.iso_published}">{format_month_day(post.date_local)} </time>'
                    f'<a class="archive-tree-post-link" href="{post.url_path}">'
                    f'<span class="archive-tree-post-title">{escape(post.title)}</span></a></li>'
                )
            open_attr = " open" if month == max(months.keys()) else ""
            month_blocks.append(
                f'<details class="archive-tree-month"{open_attr}><summary class="archive-tree-summary archive-tree-summary-month">'
                '<span class="archive-tree-caret" aria-hidden="true"></span> '
                f'<span class="archive-tree-label">{month:02d} 月</span> '
                f'<span class="archive-tree-count">{len(month_posts)} 篇</span></summary>'
                f'<ol class="archive-tree-posts">{"".join(post_items)}</ol></details>'
            )

        open_attr = " open" if year == max(grouped.keys()) else ""
        year_blocks.append(
            f'<details class="archive-tree-year"{open_attr}><summary class="archive-tree-summary archive-tree-summary-year">'
            '<span class="archive-tree-caret" aria-hidden="true"></span> '
            f'<span class="archive-tree-label">{year} 年</span> '
            f'<span class="archive-tree-count">{year_count} 篇</span></summary>'
            f'<div class="archive-tree-children">{"".join(month_blocks)}</div></details>'
        )
    return f'<div class="archive-tree">{"".join(year_blocks)}</div>'


def update_archives_index(all_posts: list[PostRecord]) -> None:
    html = read_template_text(ARCHIVES_INDEX_PATH)
    archive_html = render_archive_tree(all_posts)
    html = replace_one(
        html,
        r"<div class=\"archive-tree\">.*?</div></div><footer",
        archive_html + "</div><footer",
        flags=re.S,
        label="archive tree",
    )
    write_text(ARCHIVES_INDEX_PATH, html)


def render_tags_index(all_posts: list[PostRecord]) -> tuple[str, dict[str, list[PostRecord]]]:
    tag_posts: dict[str, list[PostRecord]] = defaultdict(list)
    for post in all_posts:
        for tag in post.tags:
            tag_posts[tag].append(post)

    tag_cards: list[str] = []
    for tag, posts in sorted(tag_posts.items(), key=lambda item: (-len(item[1]), item[0])):
        tag_cards.append(
            f'<div class="tag-link" data-href="{tag_href(tag)}" itemprop="url" role="link" tabindex="0" aria-label="{escape(tag)}">'
            '<div class="card-card"><div class="card-container">'
            f'<span class="card-link">{escape(tag)}</span> <span class="card-count">({len(posts)})</span>'
            "</div></div></div>"
        )

    block = (
        f'<h5 class="tag-tip"><i class="icon icon-lg icon-tags"></i> 目前共 <span class="card-count">{len(tag_posts)}</span> 个标签</h5>'
        f'<div class="card-pool physics-container">{"".join(tag_cards)}</div>'
    )
    return block, tag_posts


def update_tags_index(all_posts: list[PostRecord]) -> dict[str, list[PostRecord]]:
    html = read_template_text(TAGS_INDEX_PATH)
    block, tag_posts = render_tags_index(all_posts)
    html = replace_one(
        html,
        r"<h5 class=\"tag-tip\">.*?</div></div><footer",
        block + "</div><footer",
        flags=re.S,
        label="tags index block",
    )
    write_text(TAGS_INDEX_PATH, html)
    return tag_posts


def render_tag_articles(posts: list[PostRecord]) -> str:
    article_blocks: list[str] = []
    for post in sorted(posts, key=lambda item: item.date_local, reverse=True):
        article_blocks.append(
            f'<article class="archive-article" onclick=\'location.href="{post.url_path}"\'>'
            f'<div class="archive-article-date"><time class="my-post-time"><i class="icon icon-lg icon-file-text-o"></i> &nbsp; {format_day(post.date_local)}</time></div>'
            '<div class="archive-article-inner">'
            f'<h3 class="post-title" itemprop="name"><a href="{post.url_path}">{escape(post.title)}</a></h3><br>'
            f'{render_post_tags(post.tags, with_rel=True, itemprop=True)}</div></article>'
        )
    return f'<div class="waterfall">{"".join(article_blocks)}</div>'


def build_tag_detail_page(tag: str, posts: list[PostRecord]) -> str:
    html = read_template_text(TAG_TEMPLATE_PATH)
    encoded_tag = quote(tag)
    title_text = f"标签: {tag}"
    html = replace_one(
        html,
        r"<title>.*?</title>",
        f"<title>{escape(title_text)} | {escape(SITE.site_name)} | 热爱分享 &amp; 生活记录</title>",
        flags=re.S,
        label="tag page title",
    )
    html = replace_one(
        html,
        r'<meta property="og:url" content="[^"]+">',
        f'<meta property="og:url" content="{SITE.site_url}/tags/{encoded_tag}/index.html">',
        label="tag page og url",
    )
    html = replace_one(
        html,
        r"<div class=\"header-title ellipsis\">.*?</div>",
        f'<div class="header-title ellipsis">{escape(title_text)}</div>',
        flags=re.S,
        label="tag page header title",
    )
    html = replace_one(
        html,
        r"<h5 class=\"tag-tip\">.*?</h5>",
        (
            f'<h5 class="tag-tip"><i class="icon icon-tag"></i> 关于 '
            f'<span style="color:#646464">{escape(tag)}</span> 共{len(posts)}篇文章</h5>'
        ),
        flags=re.S,
        label="tag page tip",
    )
    html = replace_one(
        html,
        r"<div class=\"waterfall\">.*?</div></div><footer",
        render_tag_articles(posts) + "</div><footer",
        flags=re.S,
        label="tag page article list",
    )
    return html


def update_tag_detail_pages(tag_posts: dict[str, list[PostRecord]]) -> None:
    tags_dir = ROOT / "tags"
    for tag, posts in tag_posts.items():
        tag_dir = tags_dir / tag
        tag_dir.mkdir(parents=True, exist_ok=True)
        write_text(tag_dir / "index.html", build_tag_detail_page(tag, posts))


def build_search_index(all_posts: list[PostRecord]) -> None:
    payload = {
        "posts": [
            {
                "title": post.title,
                "path": post.path + "/",
                "date": post.iso_published,
                "tags": [{"name": tag} for tag in post.tags],
                "text": post.text,
            }
            for post in all_posts
        ]
    }
    write_text(CONTENT_JSON_PATH, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def build_nav_html(all_posts: list[PostRecord], current_index: int) -> str:
    prev_post = all_posts[current_index - 1] if current_index > 0 else None
    next_post = all_posts[current_index + 1] if current_index + 1 < len(all_posts) else None

    prev_html = (
        f'<div class="waves-block waves-effect prev"><a href="{prev_post.url_path}" id="post-prev" class="post-nav-link">'
        f'<h4 class="title">上一篇：{escape(prev_post.title)}</h4></a></div>'
        if prev_post
        else ""
    )
    next_html = (
        f'<div class="waves-block waves-effect next"><a href="{next_post.url_path}" id="post-next" class="post-nav-link">'
        f'<h4 class="title">下一篇：{escape(next_post.title)}</h4></a></div>'
        if next_post
        else ""
    )
    return f'<nav class="post-nav flex-row flex-justify-between">{prev_html}{next_html}</nav>'


def build_copyright_block(post: PostRecord) -> str:
    return (
        '<blockquote class="post-copyright"><div class="content">'
        f'<span class="post-time">最后更新：<time datetime="{post.iso_updated}" itemprop="dateUpdated">{format_title_time(post.updated_local)}</time> </span>'
        f'原文链接：<a href="{post.url_path}" target="_blank" rel="external">{post.url}</a>'
        f'</div><footer>{render_post_tags(post.tags)}'
        f'<div onclick=\'location.href="/about/"\'><img src="/img/avatar.png" alt="{escape(SITE.author_name)}"> '
        f'<a href="/about/">{escape(SITE.author_name)}</a></div></footer></blockquote>'
    )


def build_generated_article_page(post: PostRecord, all_posts: list[PostRecord], current_index: int) -> str:
    template_path = ROOT / post.template_path if post.template_path else ARTICLE_TEMPLATE_PATH
    html = read_template_text(template_path)
    old_path = "/2026/01/23/hello-world/"
    html = html.replace(old_path, post.url_path)
    html = html.replace("post-hello-world", f"post-{post.post_id}")
    html = replace_one(
        html,
        r"<div class=\"header-title ellipsis\">.*?</div>",
        f'<div class="header-title ellipsis">{escape(post.title)}</div>',
        flags=re.S,
        label="article header title",
    )
    html = replace_one(
        html,
        r"<h1 class=\"post-card-title\"[^>]*data-title=\".*?\"[^>]*>.*?</h1>",
        f'<h1 class="post-card-title" data-title="{escape(post.title)}">{escape(post.title)}</h1>',
        flags=re.S,
        label="article card title",
    )

    html = replace_one(
        html,
        r"<title>.*?</title>",
        f"<title>{escape(post.title)} | {escape(SITE.site_name)} | 热爱分享 &amp; 生活记录</title>",
        flags=re.S,
        label="article page title",
    )
    html = replace_one(
        html,
        r'<meta name="keywords" content=".*?">',
        f'<meta name="keywords" content="{escape(",".join(post.tags))}">',
        label="article keywords",
    )
    html = replace_one(
        html,
        r'<meta name="description" content=".*?">',
        f'<meta name="description" content="{escape(post.summary)}">',
        label="article description",
    )
    html = replace_one(
        html,
        r'<meta property="og:title" content=".*?">',
        f'<meta property="og:title" content="{escape(post.title)}">',
        label="article og title",
    )
    html = replace_one(
        html,
        r'<meta property="og:url" content=".*?">',
        f'<meta property="og:url" content="{escape(post.url)}index.html">',
        label="article og url",
    )
    html = replace_one(
        html,
        r'<meta property="og:description" content=".*?">',
        f'<meta property="og:description" content="{escape(post.summary)}">',
        label="article og description",
    )
    html = replace_one(
        html,
        r'<meta property="article:published_time" content=".*?">',
        f'<meta property="article:published_time" content="{post.iso_published}">',
        label="article publish time",
    )
    html = replace_one(
        html,
        r'<meta property="article:modified_time" content=".*?">',
        f'<meta property="article:modified_time" content="{post.iso_updated}">',
        label="article modified time",
    )

    author_meta_match = re.search(r'<meta property="article:author" content="[^"]+">', html)
    if not author_meta_match:
        raise RuntimeError("Could not locate article author meta")
    tag_meta = "".join(f'<meta property="article:tag" content="{escape(tag)}">' for tag in post.tags)
    html = re.sub(
        r'<meta property="article:author" content="[^"]+">(?:<meta property="article:tag" content=".*?">)+',
        author_meta_match.group(0) + tag_meta,
        html,
        count=1,
    )

    html = replace_one(
        html,
        r"<div class=\"post-meta\"><div class=\"post-meta-info\">.*?</div></div>",
        (
            '<div class="post-meta"><div class="post-meta-info">'
            f'<span><i class="icon icon-calendar"></i><time class="post-time" title="{format_title_time(post.date_local)}" '
            f'datetime="{post.iso_published}" itemprop="datePublished">{format_day(post.date_local)}</time> </span>'
            f'<span><i class="icon icon-clock-o"></i>{post.reading_minutes} 分钟阅读</span> '
            f'<span><i class="icon icon-file-text-o"></i>{format_word_count(post.word_count)}</span>'
            "</div></div>"
        ),
        flags=re.S,
        label="article meta block",
    )
    html = replace_one(
        html,
        r"<div class=\"post-content\" id=\"post-content\" itemprop=\"postContent\">.*?</div><blockquote class=\"post-copyright\">",
        f'<div class="post-content" id="post-content" itemprop="postContent">{post.html_content}</div>{build_copyright_block(post)}',
        flags=re.S,
        label="article content block",
    )
    if 'id="post-toc"' in html:
        html = replace_one(
            html,
            r"<nav class=\"post-toc-wrap[^>]*id=\"post-toc\">.*?</nav>",
            build_post_toc_html(post.html_content),
            flags=re.S,
            label="article toc",
        )
    html = replace_one(
        html,
        r"<blockquote class=\"post-copyright\">.*?</blockquote><div class=\"page-reward\">",
        build_copyright_block(post) + '<div class="page-reward">',
        flags=re.S,
        label="article copyright block",
    )
    html = replace_one(
        html,
        r"<ul class=\"article-tag-list\" itemprop=\"keywords\">.*?</ul>",
        render_post_tags(post.tags, with_rel=True, itemprop=True),
        flags=re.S,
        label="article footer tags",
    )
    html = replace_one(
        html,
        r"<nav class=\"post-nav [^\"]*\">.*?</nav>",
        build_nav_html(all_posts, current_index),
        flags=re.S,
        label="article nav",
    )
    return html


def write_generated_article_pages(all_posts: list[PostRecord]) -> None:
    for index, post in enumerate(all_posts):
        if post.source != "markdown":
            continue
        output_dir = ROOT / post.path
        output_dir.mkdir(parents=True, exist_ok=True)
        write_text(output_dir / "index.html", build_generated_article_page(post, all_posts, index))


def update_sidebar_article_counts(total_posts: int) -> None:
    pattern = re.compile(
        r'(<a class="total-link" href="/archives/"><div class="count">)\d+(</div><div class="type">文章</div></a>)'
    )
    for html_path in ROOT.rglob("*.html"):
        if ".git" in html_path.parts or ".codex-temp" in html_path.parts or "serverless" in html_path.parts:
            continue
        text = read_text(html_path)
        new_text = pattern.sub(rf"\g<1>{total_posts}\g<2>", text)
        if new_text != text:
            write_text(html_path, new_text)


def extract_existing_rss_items(previous_generated_paths: set[str]) -> dict[str, str]:
    if not RSS_PATH.exists():
        return {}
    rss_text = read_text(RSS_PATH)
    items: dict[str, str] = {}
    previous_urls = {article_url_from_path(path) for path in previous_generated_paths}
    for block in re.findall(r"<item>.*?</item>", rss_text, flags=re.S):
        link_match = re.search(r"<link>(.*?)</link>", block)
        if not link_match:
            continue
        link = link_match.group(1).strip()
        if link in previous_urls:
            continue
        items[link] = block
    return items


def build_generated_rss_item(post: PostRecord) -> str:
    categories = "".join(
        f'\n      <category domain="{tag_href(tag)}">{escape(tag)}</category>\n      ' for tag in post.tags
    )
    return (
        "    <item>\n"
        f"      <title>{escape(post.title)}</title>\n"
        f"      <link>{post.url}</link>\n"
        f"      <guid>{post.url}</guid>\n"
        f"      <pubDate>{to_rss_date(post.date_local)}</pubDate>\n"
        f"      <description>{escape(post.summary)}</description>\n"
        f"      <content:encoded><![CDATA[{post.html_content}]]></content:encoded>\n"
        f"      {categories}\n"
        f"      <comments>{post.url}#disqus_thread</comments>\n"
        "    </item>\n"
    )


def update_rss(all_posts: list[PostRecord], previous_generated_paths: set[str]) -> None:
    legacy_items = extract_existing_rss_items(previous_generated_paths)
    rss_items: list[str] = []
    for post in all_posts:
        if post.source == "markdown":
            rss_items.append(build_generated_rss_item(post))
        else:
            rss_items.append(
                legacy_items.get(
                    post.url,
                    (
                        "    <item>\n"
                        f"      <title>{escape(post.title)}</title>\n"
                        f"      <link>{post.url}</link>\n"
                        f"      <guid>{post.url}</guid>\n"
                        f"      <pubDate>{to_rss_date(post.date_local)}</pubDate>\n"
                        f"      <description>{escape(post.summary)}</description>\n"
                        "    </item>\n"
                    ),
                )
            )
    latest_date = to_rss_date(all_posts[0].updated_local if all_posts else datetime.now(LOCAL_TZ))
    rss_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<rss version="2.0"\n'
        '  xmlns:atom="http://www.w3.org/2005/Atom"\n'
        '  xmlns:content="http://purl.org/rss/1.0/modules/content/">\n'
        "  <channel>\n"
        f"    <title>{escape(SITE.site_name)}</title>\n"
        f"    <link>{SITE.site_url}/</link>\n\n"
        f'    <atom:link href="{SITE.site_url}/rss2.xml" rel="self" type="application/rss+xml"/>\n\n'
        f"    <description>{escape(SITE.site_description)}</description>\n"
        f"    <pubDate>{latest_date}</pubDate>\n"
        "    <generator>http://hexo.io/</generator>\n\n"
        f'{"".join(rss_items)}'
        "  </channel>\n"
        "</rss>\n"
    )
    write_text(RSS_PATH, rss_xml)


def update_sitemaps(all_posts: list[PostRecord], tag_posts: dict[str, list[PostRecord]]) -> None:
    fixed_pages = ["/", "/blog/", "/blog/weibo/", "/gallery/", "/about/", "/projects/", "/thinking/", "/archives/", "/tags/"]
    urls: list[tuple[str, str, str, str]] = []
    now = format_day(datetime.now(LOCAL_TZ))
    for page in fixed_pages:
        urls.append((SITE.site_url + page, now, "monthly", "0.6"))
    for post in all_posts:
        urls.append((post.url, format_day(post.updated_local), "monthly", "0.6"))
    for tag in sorted(tag_posts):
        urls.append((SITE.site_url + tag_href(tag), now, "monthly", "0.5"))

    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>\n', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for loc, lastmod, changefreq, priority in urls:
        xml_parts.append(
            "  <url>\n"
            f"    <loc>{escape(loc)}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>\n"
        )
    xml_parts.append("</urlset>\n")
    sitemap_xml = "".join(xml_parts)
    write_text(SITEMAP_XML_PATH, sitemap_xml)
    write_text(BAIDU_SITEMAP_XML_PATH, sitemap_xml)
    write_text(SITEMAP_TXT_PATH, "\n".join(loc for loc, _, _, _ in urls) + "\n")


def update_readme_hint() -> None:
    if not README_PATH.exists():
        return
    text = read_text(README_PATH)
    marker = "## 7. 如何写并发布博客文章"
    hint = (
        "## Markdown 发文新方式\n\n"
        "现在已经支持“只新增一个 Markdown 文件就自动生成文章”。\n\n"
        "推荐新流程：\n\n"
        "1. 把新文章写到 `markdown-posts/你的文章名.md`\n"
        "2. 本地双击 `build-markdown-posts.bat`，或者直接推到 GitHub\n"
        "3. GitHub Actions 会自动生成文章页、博客首页、搜索、归档、标签和 sitemap\n\n"
        "Markdown 模板文件：`markdown-posts/_template.md`\n\n"
    )
    if hint in text:
        return
    if marker in text:
        write_text(README_PATH, text.replace(marker, hint + marker, 1))


def main() -> None:
    previous_manifest = load_previous_manifest()
    previous_generated_paths = {normalize_path(item.get("path", "")) for item in previous_manifest if item.get("path")}

    legacy_posts = build_legacy_posts(previous_generated_paths)
    legacy_paths = {post.path for post in legacy_posts}
    markdown_posts = build_markdown_posts(previous_generated_paths, legacy_paths)
    markdown_paths = {post.path for post in markdown_posts}
    legacy_posts = [post for post in legacy_posts if post.path not in markdown_paths]
    if not markdown_posts and not previous_manifest:
        write_text(MANIFEST_PATH, "[]\n")
        update_readme_hint()
        print(f"Built 0 markdown post(s). Total posts: {len(legacy_posts)}.")
        return

    all_posts = sorted(legacy_posts + markdown_posts, key=lambda item: item.date_local, reverse=True)

    write_generated_article_pages(all_posts)
    update_blog_index(all_posts)
    update_archives_index(all_posts)
    tag_posts = update_tags_index(all_posts)
    update_tag_detail_pages(tag_posts)
    build_search_index(all_posts)
    update_sidebar_article_counts(len(all_posts))
    update_rss(all_posts, previous_generated_paths)
    update_sitemaps(all_posts, tag_posts)
    write_text(MANIFEST_PATH, json.dumps(build_generated_manifest(markdown_posts), ensure_ascii=False, indent=2))
    update_readme_hint()

    print(f"Built {len(markdown_posts)} markdown post(s). Total posts: {len(all_posts)}.")


if __name__ == "__main__":
    main()
