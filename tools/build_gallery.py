from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT / "gallery" / "gallery-albums.txt"
GALLERY_INDEX_PATH = ROOT / "gallery" / "index.html"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}


@dataclass
class PhotoRecord:
    title: str
    src: str
    description: str


@dataclass
class AlbumRecord:
    title: str
    subtitle: str
    cover: str
    photos: list[PhotoRecord] = field(default_factory=list)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


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


def replace_one(text: str, pattern: str, replacement: str, *, label: str) -> str:
    new_text, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Could not update {label}")
    return new_text


def parse_key_value_file(path: Path) -> tuple[dict[str, str], list[dict[str, object]]]:
    global_config: dict[str, str] = {}
    album_blocks: list[dict[str, object]] = []
    current_album: dict[str, object] | None = None

    for index, raw_line in enumerate(read_text(path).splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue

        if line.lower() == "[album]":
            if current_album is not None:
                album_blocks.append(current_album)
            current_album = {"photos": []}
            continue

        if "=" not in line:
            raise RuntimeError(f"Invalid line {index} in {path.name}: {raw_line}")

        key, value = line.split("=", 1)
        key = key.strip().lower()
        value = value.strip()

        if current_album is None:
            global_config[key] = value
            continue

        if key == "photo":
            current_album.setdefault("photos", []).append(value)
        else:
            current_album[key] = value

    if current_album is not None:
        album_blocks.append(current_album)

    return global_config, album_blocks


def resolve_local_path(value: str, *, base: Path | None = None) -> Path:
    value = value.strip()
    if not value:
        raise RuntimeError("Encountered an empty path value in gallery config")

    if value.startswith("/"):
        return (ROOT / value.lstrip("/")).resolve()

    candidate = Path(value)
    if candidate.is_absolute():
        return candidate.resolve()

    if base is None:
        return (ROOT / candidate).resolve()

    return (base / candidate).resolve()


def to_web_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(ROOT)
    except ValueError as exc:
        raise RuntimeError(f"Gallery file is outside the project root: {resolved}") from exc
    return "/" + relative.as_posix()


def looks_like_file_path(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    if text.startswith("/") or Path(text).suffix.lower() in IMAGE_EXTENSIONS:
        return True
    return bool(re.match(r"^[A-Za-z]:[\\/]", text))


def humanize_stem(value: str) -> str:
    return re.sub(r"[-_]+", " ", value).strip() or "未命名照片"


def parse_photo_entry(raw_value: str, *, album_folder: Path) -> PhotoRecord:
    parts = [part.strip() for part in raw_value.split("|")]

    if len(parts) == 1:
        file_value = parts[0]
        title = humanize_stem(Path(file_value).stem)
        description = ""
    elif len(parts) == 2:
        if looks_like_file_path(parts[0]):
            file_value = parts[0]
            title = humanize_stem(Path(file_value).stem)
            description = parts[1]
        else:
            title = parts[0]
            file_value = parts[1]
            description = ""
    else:
        title = parts[0] or "未命名照片"
        file_value = parts[1]
        description = "|".join(parts[2:]).strip()

    file_path = resolve_local_path(file_value, base=album_folder)
    if not file_path.exists():
        raise RuntimeError(f"Photo file not found: {file_path}")

    return PhotoRecord(title=title, src=to_web_path(file_path), description=description)


def auto_discover_photos(album_folder: Path) -> list[PhotoRecord]:
    candidates = sorted(
        path
        for path in album_folder.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    if not candidates:
        raise RuntimeError(f"No image files found in album folder: {album_folder}")

    return [
        PhotoRecord(
            title=humanize_stem(path.stem),
            src=to_web_path(path),
            description="",
        )
        for path in candidates
    ]


def build_albums(config_path: Path) -> tuple[dict[str, str], list[AlbumRecord]]:
    global_config, album_blocks = parse_key_value_file(config_path)

    upload_root_value = global_config.get("upload_root")
    if not upload_root_value:
        raise RuntimeError(f"Missing upload_root in {config_path.name}")
    upload_root = resolve_local_path(upload_root_value)
    upload_root.mkdir(parents=True, exist_ok=True)

    albums: list[AlbumRecord] = []
    for block_index, block in enumerate(album_blocks, start=1):
        title = str(block.get("title") or "").strip()
        subtitle = str(block.get("subtitle") or "").strip()
        folder_value = str(block.get("folder") or "").strip()
        cover_value = str(block.get("cover") or "").strip()
        photo_entries = list(block.get("photos") or [])

        if not title:
            raise RuntimeError(f"Album #{block_index} is missing title")
        if not folder_value:
            raise RuntimeError(f"Album '{title}' is missing folder")

        album_folder = resolve_local_path(folder_value, base=upload_root)
        album_folder.mkdir(parents=True, exist_ok=True)

        if photo_entries:
            photos = [parse_photo_entry(str(item), album_folder=album_folder) for item in photo_entries]
        else:
            photos = auto_discover_photos(album_folder)

        if cover_value:
            cover_path = resolve_local_path(cover_value, base=album_folder)
            if not cover_path.exists():
                raise RuntimeError(f"Cover file not found for album '{title}': {cover_path}")
            cover = to_web_path(cover_path)
        else:
            cover = photos[0].src

        albums.append(AlbumRecord(title=title, subtitle=subtitle, cover=cover, photos=photos))

    if not albums:
        raise RuntimeError(f"No album sections found in {config_path.name}")

    return global_config, albums


def build_gallery_overview_html(config: dict[str, str], album_count: int, photo_count: int) -> str:
    overview_label = config.get("overview_label", "Album Archive")
    overview_title = config.get("overview_title", "把生活碎片收进相册里，想看的时候就翻出来。")
    return (
        '<section class="gallery-overview">'
        f"<div><small>{escape(overview_label)}</small><h2>{escape(overview_title)}</h2></div>"
        f'<p class="gallery-total">目前收录 <strong>{album_count}</strong> 本相册，<strong>{photo_count}</strong> 张照片</p>'
        "</section>"
    )


def build_gallery_copy_html(config: dict[str, str]) -> str:
    overview_copy = config.get(
        "overview_copy",
        "每一本相册都可以继续往里加照片，点开后支持上一张、下一张和右上角关闭。",
    )
    return f'<div class="post-content page-content gallery-copy"><p>{escape(overview_copy)}</p></div>'


def build_gallery_album_list_html(albums: list[AlbumRecord]) -> str:
    parts: list[str] = ['<section class="gallery-album-list">']
    for album_index, album in enumerate(albums):
        first_photo = album.photos[0]
        photo_buttons = []
        for photo_index, photo in enumerate(album.photos):
            photo_buttons.append(
                f'<button type="button" class="gallery-album-photo" data-gallery-album="{album_index}" '
                f'data-gallery-photo="{photo_index}" aria-label="查看 {escape(photo.title)}">'
                f'<img src="{escape(photo.src)}" alt="{escape(photo.title)}"></button>'
            )

        parts.append(
            f'<article class="gallery-album" data-album="{album_index}">'
            f'<button type="button" class="gallery-album-hero" data-gallery-album="{album_index}" '
            f'data-gallery-photo="0" aria-label="打开 {escape(album.title)}">'
            f'<img src="{escape(album.cover)}" alt="{escape(album.title)}">'
            '<span class="gallery-album-open">打开相册</span></button>'
            '<div class="gallery-album-meta"><div>'
            f"<h3>{escape(album.title)}</h3><p>{escape(album.subtitle)}</p></div>"
            f'<div class="gallery-album-count"><span>{len(album.photos)}</span> 张照片</div></div>'
            f'<div class="gallery-album-strip">{" ".join(photo_buttons)}</div></article>'
        )

    parts.append("</section>")
    return "".join(parts)


def build_gallery_script_html(albums: list[AlbumRecord]) -> str:
    payload = [
        {
            "title": album.title,
            "subtitle": album.subtitle,
            "photos": [
                {
                    "src": photo.src,
                    "thumb": photo.src,
                    "title": photo.title,
                    "description": photo.description,
                }
                for photo in album.photos
            ],
        }
        for album in albums
    ]
    return f"<script>window.galleryAlbums={json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}</script>"


def update_gallery_index(config: dict[str, str], albums: list[AlbumRecord]) -> None:
    html = read_text(GALLERY_INDEX_PATH)
    if "\\1" in html or "\\2" in html:
        html = read_head_text(GALLERY_INDEX_PATH) or html
    page_subtitle = config.get("page_subtitle", "这里放生活切片、界面草稿和想留下来的旅途画面。")
    album_count = len(albums)
    photo_count = sum(len(album.photos) for album in albums)
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    html = replace_one(
        html,
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{escape(page_subtitle)}">',
        label="meta description",
    )
    html = replace_one(
        html,
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{escape(page_subtitle)}">',
        label="og description",
    )
    html = replace_one(
        html,
        r'<meta property="article:modified_time" content="[^"]*">',
        f'<meta property="article:modified_time" content="{modified}">',
        label="article modified time",
    )
    html = replace_one(
        html,
        r'(<header class="content-header page-header gallery-header"><div class="container fade-scale"><div id="myheader"><h1 class="title">相册</h1><h5 class="subtitle">).*?(</h5></div></div></header>)',
        (
            '<header class="content-header page-header gallery-header"><div class="container fade-scale">'
            '<div id="myheader"><h1 class="title">相册</h1>'
            f'<h5 class="subtitle">{escape(page_subtitle)}</h5></div></div></header>'
        ),
        label="gallery subtitle",
    )
    html = replace_one(
        html,
        r'(<a class="total-link" href="/gallery/"><div class="count">)\d+(</div><div class="type">相册</div></a>)',
        f'<a class="total-link" href="/gallery/"><div class="count">{album_count}</div><div class="type">相册</div></a>',
        label="gallery sidebar count",
    )
    html = replace_one(
        html,
        r'<section class="gallery-overview">.*?</section>',
        build_gallery_overview_html(config, album_count, photo_count),
        label="gallery overview",
    )
    html = replace_one(
        html,
        r'<div class="post-content page-content gallery-copy">.*?</div>',
        build_gallery_copy_html(config),
        label="gallery copy",
    )
    html = replace_one(
        html,
        r'<section class="gallery-album-list">.*?</section>',
        build_gallery_album_list_html(albums),
        label="gallery album list",
    )
    html = replace_one(
        html,
        r'<script>window\.galleryAlbums=.*?</script>',
        build_gallery_script_html(albums),
        label="gallery script payload",
    )

    write_text(GALLERY_INDEX_PATH, html)


def main() -> None:
    config_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_CONFIG_PATH
    if not config_path.exists():
        raise SystemExit(f"Gallery config file not found: {config_path}")

    config, albums = build_albums(config_path)
    update_gallery_index(config, albums)
    total_photos = sum(len(album.photos) for album in albums)
    print(f"Built gallery with {len(albums)} album(s) and {total_photos} photo(s).")


if __name__ == "__main__":
    main()
