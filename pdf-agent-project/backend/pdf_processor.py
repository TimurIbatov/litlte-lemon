"""Fill affidavit name and passport fields in memory."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf as fitz

FIELD_KEYS = (
    "workerFio",
    "workerPassport",
    "workerDob",
    "fatherSurname",
    "fatherGiven",
    "fatherPassport",
    "fatherDob",
    "motherSurname",
    "motherGiven",
    "motherPassport",
    "motherDob",
    "spouseFio",
    "spousePassport",
    "spouseDob",
    "child1Fio",
    "child1Passport",
    "child1Dob",
    "child2Fio",
    "child2Passport",
    "child2Dob",
)
FIELD_TITLES = {
    "workerFio": "ФИО работника",
    "workerPassport": "Паспорт работника",
    "workerDob": "Дата рождения работника",
    "fatherSurname": "Фамилия отца",
    "fatherGiven": "Имя отца",
    "fatherPassport": "Паспорт отца",
    "fatherDob": "Дата рождения отца",
    "motherSurname": "Фамилия матери",
    "motherGiven": "Имя матери",
    "motherPassport": "Паспорт матери",
    "motherDob": "Дата рождения матери",
    "spouseFio": "ФИО супруги",
    "spousePassport": "Паспорт супруги",
    "spouseDob": "Дата рождения супруги",
    "child1Fio": "ФИО ребенка 1",
    "child1Passport": "Паспорт ребенка 1",
    "child1Dob": "Дата рождения ребенка 1",
    "child2Fio": "ФИО ребенка 2",
    "child2Passport": "Паспорт ребенка 2",
    "child2Dob": "Дата рождения ребенка 2",
}
# Surname and given name are separate cells. The form stores them as one FIO string.
PAIR_FIO_FIELDS = frozenset({"spouseFio", "child1Fio", "child2Fio"})
# Passport cell is empty. Write it on the row of the paired surname.
BLANK_PASSPORT_OF = {
    "child1Passport": "child1Fio",
    "child2Passport": "child2Fio",
}
# This affidavit has no printed worker date of birth.
NO_PRINTED_DATE = frozenset({"workerDob"})
_PASSPORT_TOKEN = re.compile(r"^[A-Z]{1,3}\d{5,}$")
_DASH_VALUES = frozenset({"-", "–", "—", "−", "‑"})
DEFAULT_FONT_SIZE = 11.0
ANCHOR_FIELD_WIDTH = 300.0
MAX_VALUE_LENGTH = 400
MAX_NEEDLE_LENGTH = 300
_FONT_NAME = "formtnr"

_FONT_CANDIDATES = (
    Path(__file__).resolve().parent / "fonts" / "LiberationSerif-Bold.ttf",
    Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"),
)


class PdfProcessError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class _Placement:
    page_index: int
    source_rect: fitz.Rect
    value: str
    fontsize: float
    baseline: float
    room: float
    prefix: str = ""
    in_place: bool = False
    fit_width: float = 0.0


def process_pdf_bytes(pdf_bytes: bytes, payload: object) -> bytes:
    if not isinstance(payload, dict):
        raise PdfProcessError("jsonData должен быть JSON-объектом.")

    mode = payload.get("mode")
    if mode not in ("anchor", "replace"):
        raise PdfProcessError('Поле mode должно быть "anchor" или "replace".')

    values = _field_values(payload)
    dummies = _search_strings(payload, "dummies")
    anchors = _search_strings(payload, "anchors")
    needles = anchors if mode == "anchor" else dummies
    fontfile = _resolve_font()

    doc: fitz.Document | None = None
    try:
        doc = _open_document(pdf_bytes)
        placements: list[_Placement] = []
        for key in FIELD_KEYS:
            placements.extend(
                _placements_for(doc, key, values[key], needles, dummies, mode)
            )
        font = fitz.Font(fontfile=fontfile)
        for placement in placements:
            page = doc[placement.page_index]
            _apply_field(page, placement, mode, font, fontfile)
        return doc.tobytes(garbage=4, deflate=True)
    except PdfProcessError:
        raise
    except Exception as exc:
        raise PdfProcessError(
            "Не удалось вписать данные в PDF.",
            status_code=500,
        ) from exc
    finally:
        if doc is not None:
            doc.close()


def _open_document(pdf_bytes: bytes) -> fitz.Document:
    if not pdf_bytes.startswith(b"%PDF"):
        raise PdfProcessError("Файл не является PDF.")
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        lowered = str(exc).lower()
        if "password" in lowered or "encrypt" in lowered:
            raise PdfProcessError(
                "PDF зашифрован. Загрузите файл без пароля."
            ) from exc
        raise PdfProcessError(
            "Не удалось открыть PDF. Файл повреждён или имеет неверный формат."
        ) from exc
    if getattr(doc, "needs_pass", 0):
        doc.close()
        raise PdfProcessError("PDF зашифрован. Загрузите файл без пароля.")
    if doc.page_count == 0:
        doc.close()
        raise PdfProcessError("PDF пуст: в файле нет страниц.")
    return doc


def _field_values(payload: dict) -> dict[str, str]:
    values: dict[str, str] = {}
    for key in FIELD_KEYS:
        raw = payload.get(key)
        title = FIELD_TITLES[key]
        if not isinstance(raw, str) or not raw.strip():
            raise PdfProcessError(f"Заполните поле «{title}».")
        text = "-" if _is_dash(raw.strip()) else raw.strip()
        if len(text) > MAX_VALUE_LENGTH:
            raise PdfProcessError(f"Поле «{title}» длиннее {MAX_VALUE_LENGTH} символов.")
        values[key] = text
    return values


def _search_strings(payload: dict, map_key: str) -> dict[str, str]:
    raw_map = payload.get(map_key)
    if not isinstance(raw_map, dict):
        label = "якорей" if map_key == "anchors" else "рыб"
        raise PdfProcessError(f"Поле {map_key} должно быть объектом строк {label}.")
    needles: dict[str, str] = {}
    for key in FIELD_KEYS:
        raw = raw_map.get(key)
        title = FIELD_TITLES[key]
        if not isinstance(raw, str) or (
            not raw.strip() and key not in BLANK_PASSPORT_OF and key not in NO_PRINTED_DATE
        ):
            raise PdfProcessError(f"Не задана строка поиска для «{title}».")
        needle = raw.strip()
        if len(needle) > MAX_NEEDLE_LENGTH:
            raise PdfProcessError(
                f"Строка поиска для «{title}» длиннее {MAX_NEEDLE_LENGTH} символов."
            )
        needles[key] = needle
    return needles


def _placements_for(
    doc: fitz.Document,
    key: str,
    value: str,
    needles: dict[str, str],
    dummies: dict[str, str],
    mode: str,
) -> list[_Placement]:
    title = FIELD_TITLES[key]
    if key in NO_PRINTED_DATE and not needles[key]:
        return []
    if key in BLANK_PASSPORT_OF and not needles[key]:
        surname, _given = _split_fio(dummies[BLANK_PASSPORT_OF[key]], FIELD_TITLES[BLANK_PASSPORT_OF[key]])
        return _blank_passport_slots(doc, surname, value, title)
    if key in PAIR_FIO_FIELDS and mode == "replace":
        return _replace_split_fio(doc, needles[key], value, title)
    return _locate_all(
        doc,
        needles[key],
        value,
        title,
        mode,
        fit_to_span=key == "workerFio" and mode == "replace",
    )


def _is_dash(text: str) -> bool:
    return text in _DASH_VALUES


def _split_fio(text: str, title: str) -> tuple[str, str]:
    parts = text.split()
    if len(parts) < 2:
        raise PdfProcessError(f"Поле «{title}» нужно в виде «фамилия имя».")
    return parts[0], " ".join(parts[1:])


def _pair_values(value: str, title: str) -> tuple[str, str]:
    # A single hyphen fills both cells. It is not an empty field.
    if _is_dash(value):
        return "-", "-"
    return _split_fio(value, title)


def _replace_split_fio(doc: fitz.Document, needle: str, value: str, title: str) -> list[_Placement]:
    surname_needle, given_needle = _split_fio(needle, title)
    surname_value, given_value = _pair_values(value, title)
    return [
        *_locate_all(doc, surname_needle, surname_value, title, "replace"),
        *_locate_all(doc, given_needle, given_value, title, "replace"),
    ]


def _blank_passport_slots(
    doc: fitz.Document,
    surname: str,
    value: str,
    title: str,
) -> list[_Placement]:
    rows = _locate_all(doc, surname, value, title, "replace")
    slots: list[_Placement] = []
    for row in rows:
        page = doc[row.page_index]
        x0 = _passport_column_x(page, row.source_rect)
        x1 = min(row.source_rect.x0 - 8, x0 + 90)
        if x1 - x0 < 24:
            raise PdfProcessError(
                f"Не удалось найти пустую ячейку паспорта в строке «{surname}» ({title})."
            )
        rect = fitz.Rect(x0, row.source_rect.y0, x1, row.source_rect.y1)
        slots.append(
            _Placement(
                page_index=row.page_index,
                source_rect=rect,
                value=value,
                fontsize=row.fontsize,
                baseline=row.baseline,
                room=rect.width,
                in_place=True,
            )
        )
    return slots


def _passport_column_x(page: fitz.Page, surname: fitz.Rect) -> float:
    surname_y = (surname.y0 + surname.y1) / 2
    found: list[float] = []
    for word in page.get_text("words"):
        token = _norm_token(word[4]).upper()
        if not _PASSPORT_TOKEN.match(token):
            continue
        rect = fitz.Rect(word[:4])
        if rect.x1 > surname.x0 - 8:
            continue
        word_y = (rect.y0 + rect.y1) / 2
        if abs(word_y - surname_y) > 90:
            continue
        found.append(rect.x0)
    if found:
        found.sort()
        return found[len(found) // 2]
    return max(page.rect.x0 + 8, surname.x0 - 94)


def _locate_all(
    doc: fitz.Document,
    needle: str,
    value: str,
    title: str,
    mode: str,
    fit_to_span: bool = False,
) -> list[_Placement]:
    found: list[_Placement] = []
    for index, page in enumerate(doc):
        try:
            hits = [fitz.Rect(hit) for hit in page.search_for(needle)]
        except Exception as exc:
            raise PdfProcessError(
                f"Не удалось найти строку «{needle}» ({title})."
            ) from exc
        if not hits:
            continue
        if mode == "anchor":
            rect = hits[0]
            size, baseline = _span_metrics(page, rect)
            found.append(
                _Placement(
                    page_index=index,
                    source_rect=rect,
                    value=value,
                    fontsize=size,
                    baseline=baseline,
                    room=ANCHOR_FIELD_WIDTH,
                    fit_width=rect.width if fit_to_span else 0.0,
                )
            )
            return found
        for rect in _whole_matches(page, hits, needle):
            size, baseline = _span_metrics(page, rect)
            found.append(
                _Placement(
                    page_index=index,
                    source_rect=rect,
                    value=value,
                    fontsize=size,
                    baseline=baseline,
                    room=_room_width(page, rect),
                    prefix=_kept_prefix(page, rect, needle),
                    in_place=True,
                    fit_width=rect.width if fit_to_span else 0.0,
                )
            )
    if not found:
        raise PdfProcessError(
            f"В документе не найдена строка «{needle}» ({title}).",
            status_code=422,
        )
    return found


def _union(a: fitz.Rect, b: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(min(a.x0, b.x0), min(a.y0, b.y0), max(a.x1, b.x1), max(a.y1, b.y1))


def _same_line(a: fitz.Rect, b: fitz.Rect) -> bool:
    ay = (a.y0 + a.y1) / 2
    by = (b.y0 + b.y1) / 2
    return abs(ay - by) <= max(4.0, 0.65 * max(a.height, b.height))


def _near_x(a: fitz.Rect, b: fitz.Rect) -> bool:
    return a.x0 <= b.x1 + 14 and b.x0 <= a.x1 + 14


def _cluster_rects(rects: list[fitz.Rect]) -> list[fitz.Rect]:
    clusters: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda item: ((item.y0 + item.y1) / 2, item.x0)):
        placed = False
        for index, cluster in enumerate(clusters):
            if _same_line(cluster, rect) and _near_x(cluster, rect):
                clusters[index] = _union(cluster, rect)
                placed = True
                break
        if not placed:
            clusters.append(fitz.Rect(rect))
    changed = True
    while changed:
        changed = False
        folded: list[fitz.Rect] = []
        for rect in clusters:
            placed = False
            for index, cluster in enumerate(folded):
                if _same_line(cluster, rect) and _near_x(cluster, rect):
                    folded[index] = _union(cluster, rect)
                    placed = True
                    changed = True
                    break
            if not placed:
                folded.append(rect)
        clusters = folded
    return clusters


_PUNCT = str.maketrans("", "", ".,;:\"'«»()[]")


def _norm_token(text: str) -> str:
    return " ".join(text.replace("№", " ").translate(_PUNCT).split()).casefold()


def _whole_matches(page: fitz.Page, hits: list[fitz.Rect], needle: str) -> list[fitz.Rect]:
    needle_norm = _norm_token(needle)
    words: list[tuple[fitz.Rect, str]] = []
    for word in page.get_text("words"):
        token = _norm_token(word[4])
        if token:
            words.append((fitz.Rect(word[:4]), token))
    accepted: list[fitz.Rect] = []
    for cluster in _cluster_rects(hits):
        chosen: list[tuple[fitz.Rect, str]] = []
        for rect, token in words:
            inter = rect & cluster
            if inter.is_empty or rect.get_area() <= 0:
                continue
            if inter.get_area() < 0.35 * min(rect.get_area(), cluster.get_area()):
                continue
            parts = needle_norm.split()
            if token == needle_norm or token in parts or needle_norm in token:
                chosen.append((rect, token))
        unique: list[tuple[fitz.Rect, str]] = []
        for rect, token in chosen:
            if any(
                abs(prev.x0 - rect.x0) < 2 and abs(prev.y0 - rect.y0) < 2 and prev_token == token
                for prev, prev_token in unique
            ):
                continue
            unique.append((rect, token))
        unique.sort(key=lambda item: (item[0].x0, item[0].y0))
        if " ".join(token for _, token in unique) != needle_norm:
            continue
        rect = unique[0][0]
        for extra, _ in unique[1:]:
            rect = _union(rect, extra)
        accepted.append(rect)
    return accepted


def _kept_prefix(page: fitz.Page, rect: fitz.Rect, needle: str) -> str:
    if needle.startswith("№"):
        return ""
    for word in page.get_text("words"):
        word_rect = fitz.Rect(word[:4])
        inter = word_rect & rect
        if inter.is_empty or word_rect.get_area() <= 0:
            continue
        if inter.get_area() < 0.5 * word_rect.get_area():
            continue
        if str(word[4]).startswith("№"):
            return "№"
    return ""


def _span_metrics(page: fitz.Page, rect: fitz.Rect) -> tuple[float, float]:
    size = DEFAULT_FONT_SIZE
    baseline = rect.y1 - size * 0.24
    best = 0.0
    clip = fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)
    try:
        data = page.get_text("dict", clip=clip)
    except Exception:
        return size, baseline
    for block in data.get("blocks", []):
        if block.get("type", 0) != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                bbox = span.get("bbox")
                if not bbox:
                    continue
                span_rect = fitz.Rect(bbox)
                inter = span_rect & rect
                if inter.is_empty:
                    continue
                area = inter.get_area()
                if area <= best:
                    continue
                best = area
                raw_size = span.get("size")
                if isinstance(raw_size, (int, float)) and 6 <= float(raw_size) <= 36:
                    size = float(raw_size)
                origin = span.get("origin")
                if isinstance(origin, (list, tuple)) and len(origin) >= 2:
                    baseline = float(origin[1])
    return size, baseline


def _room_width(page: fitz.Page, rect: fitz.Rect) -> float:
    limit = page.rect.x1 - 28
    for word in page.get_text("words"):
        word_rect = fitz.Rect(word[:4])
        if word_rect.x0 <= rect.x1 + 0.4:
            continue
        if not _same_line(rect, word_rect):
            continue
        limit = min(limit, word_rect.x0 - 2)
    return max(rect.width, limit - rect.x0)


def _apply_field(
    page: fitz.Page,
    placement: _Placement,
    mode: str,
    font: fitz.Font,
    fontfile: str,
) -> None:
    source = placement.source_rect
    written = placement.value
    if placement.prefix and not written.startswith(placement.prefix):
        written = f"{placement.prefix}{written}"
    if mode == "anchor" and not placement.in_place:
        redact_rect = _anchor_slot(page, source)
        insert_x = redact_rect.x0 + 2
        available = max(0.0, redact_rect.width - 4)
        baseline = placement.baseline
    else:
        # Cover the old glyphs only. Do not grow the box into the next cell or the rules.
        redact_rect = fitz.Rect(source)
        insert_x = source.x0
        available = max(source.width, placement.room)
        baseline = placement.baseline
    fontsize = placement.fontsize
    if placement.fit_width <= 1:
        fontsize = _fitted_size(font, written, fontsize, available)

    page.add_redact_annot(redact_rect, fill=(1, 1, 1))
    _apply_redactions(page)
    # Redaction drops a font that was registered but not used yet.
    page.insert_font(fontname=_FONT_NAME, fontfile=fontfile)
    point = fitz.Point(insert_x, baseline)
    _paint_name(page, point, written, font, fontfile, fontsize, placement.fit_width)


def _paint_name(
    page: fitz.Page,
    point: fitz.Point,
    text: str,
    font: fitz.Font,
    fontfile: str,
    fontsize: float,
    fit_width: float,
) -> None:
    """Draw worker names across the old name's width. Height and baseline stay put."""
    if fit_width <= 1 or not text:
        page.insert_text(
            point,
            text,
            fontname=_FONT_NAME,
            fontfile=fontfile,
            fontsize=fontsize,
            color=(0, 0, 0),
            overlay=True,
        )
        return
    widths = [max(0.0, font.text_length(ch, fontsize=fontsize)) for ch in text]
    natural = sum(widths)
    if natural <= 0:
        return
    if natural > fit_width + 0.4:
        hscale = fit_width / natural
        page.insert_text(
            point,
            text,
            fontname=_FONT_NAME,
            fontfile=fontfile,
            fontsize=fontsize,
            color=(0, 0, 0),
            overlay=True,
            morph=(point, fitz.Matrix(hscale, 1)),
        )
        return
    gaps = max(1, len(text) - 1)
    pad = (fit_width - natural) / gaps
    x = point.x
    for ch, width in zip(text, widths):
        if ch != " ":
            page.insert_text(
                fitz.Point(x, point.y),
                ch,
                fontname=_FONT_NAME,
                fontfile=fontfile,
                fontsize=fontsize,
                color=(0, 0, 0),
                overlay=True,
            )
        x += width + pad


def _anchor_slot(page: fitz.Page, source: fitz.Rect) -> fitz.Rect:
    x0 = source.x1 + 6
    y0 = source.y0 - 1
    x1 = x0 + ANCHOR_FIELD_WIDTH
    y1 = source.y1 + 3
    return _clip_rect(page, fitz.Rect(x0, y0, x1, y1))


def _clip_rect(page: fitz.Page, rect: fitz.Rect) -> fitz.Rect:
    bounds = page.rect
    x0 = max(rect.x0, bounds.x0 + 4)
    y0 = max(rect.y0, bounds.y0 + 4)
    x1 = min(rect.x1, bounds.x1 - 4)
    y1 = min(rect.y1, bounds.y1 - 4)
    if x1 - x0 < 8 or y1 - y0 < 2:
        raise PdfProcessError("Область для вставки выходит за пределы страницы.")
    return fitz.Rect(x0, y0, x1, y1)


def _fitted_size(font: fitz.Font, text: str, fontsize: float, available: float) -> float:
    if available < 12:
        return fontsize
    try:
        width = font.text_length(text, fontsize=fontsize)
    except Exception:
        return fontsize
    if width <= available or width <= 0:
        return fontsize
    return max(8.0, fontsize * (available / width))


def _apply_redactions(page: fitz.Page) -> None:
    kwargs: dict[str, int] = {}
    images = getattr(fitz, "PDF_REDACT_IMAGE_NONE", None)
    graphics = getattr(fitz, "PDF_REDACT_LINE_ART_NONE", None)
    text_mode = getattr(fitz, "PDF_REDACT_TEXT_REMOVE", None)
    if images is not None:
        kwargs["images"] = images
    if graphics is not None:
        kwargs["graphics"] = graphics
    if text_mode is not None:
        kwargs["text"] = text_mode
    try:
        page.apply_redactions(**kwargs)
    except TypeError:
        page.apply_redactions()


def _resolve_font() -> str:
    override = os.environ.get("PDF_EDITOR_FONT", "").strip()
    if override:
        path = Path(override)
        if path.is_file():
            return str(path)
        raise PdfProcessError(
            "PDF_EDITOR_FONT не указывает на файл шрифта.",
            status_code=500,
        )
    for candidate in _FONT_CANDIDATES:
        if candidate.is_file():
            return str(candidate)
    raise PdfProcessError(
        "Не найден Liberation Serif Bold (LiberationSerif-Bold.ttf).",
        status_code=500,
    )
