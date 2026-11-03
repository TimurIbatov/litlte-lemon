"""Fill four personal fields in a PDF, entirely in memory."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pymupdf as fitz

FIELD_KEYS = ("parentFio", "parentPassport", "childFio", "childPassport")
FIELD_TITLES = {
    "parentFio": "ФИО родителя",
    "parentPassport": "Паспорт родителя",
    "childFio": "ФИО ребенка",
    "childPassport": "Паспорт / свидетельство ребенка",
}
DEFAULT_FONT_SIZE = 11.0
ANCHOR_FIELD_WIDTH = 300.0
MAX_VALUE_LENGTH = 400
MAX_NEEDLE_LENGTH = 300
_FONT_NAME = "formcyr"

_FONT_CANDIDATES = (
    Path(__file__).resolve().parent / "fonts" / "DejaVuSans.ttf",
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"),
    Path("/Library/Fonts/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("C:/Windows/Fonts/arial.ttf"),
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


def process_pdf_bytes(pdf_bytes: bytes, payload: object) -> bytes:
    if not isinstance(payload, dict):
        raise PdfProcessError("jsonData должен быть JSON-объектом.")

    mode = payload.get("mode")
    if mode not in ("anchor", "replace"):
        raise PdfProcessError('Поле mode должно быть "anchor" или "replace".')

    values = _field_values(payload)
    needles = _search_strings(payload, "anchors" if mode == "anchor" else "dummies")
    fontfile = _resolve_font()

    doc: fitz.Document | None = None
    try:
        doc = _open_document(pdf_bytes)
        placements = [
            _locate(doc, needles[key], values[key], FIELD_TITLES[key])
            for key in FIELD_KEYS
        ]
        font = fitz.Font(fontfile=fontfile)
        loaded_pages: set[int] = set()
        for placement in placements:
            page = doc[placement.page_index]
            if placement.page_index not in loaded_pages:
                page.insert_font(fontname=_FONT_NAME, fontfile=fontfile)
                loaded_pages.add(placement.page_index)
            _apply_field(page, placement, mode, font)
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
        text = raw.strip()
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
        if not isinstance(raw, str) or not raw.strip():
            raise PdfProcessError(f"Не задана строка поиска для «{title}».")
        needle = raw.strip()
        if len(needle) > MAX_NEEDLE_LENGTH:
            raise PdfProcessError(
                f"Строка поиска для «{title}» длиннее {MAX_NEEDLE_LENGTH} символов."
            )
        needles[key] = needle
    return needles


def _locate(doc: fitz.Document, needle: str, value: str, title: str) -> _Placement:
    for index, page in enumerate(doc):
        try:
            hits = page.search_for(needle)
        except Exception as exc:
            raise PdfProcessError(
                f"Не удалось найти строку «{needle}» ({title})."
            ) from exc
        if not hits:
            continue
        rect = fitz.Rect(hits[0])
        return _Placement(
            page_index=index,
            source_rect=rect,
            value=value,
            fontsize=_font_size_near(page, rect),
        )
    raise PdfProcessError(
        f"В документе не найдена строка «{needle}» ({title}).",
        status_code=422,
    )


def _font_size_near(page: fitz.Page, rect: fitz.Rect) -> float:
    try:
        data = page.get_text("dict", clip=rect)
    except Exception:
        return DEFAULT_FONT_SIZE
    for block in data.get("blocks", []):
        if block.get("type", 0) != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                size = span.get("size")
                if isinstance(size, (int, float)) and 6 <= float(size) <= 36:
                    return round(float(size), 2)
    return DEFAULT_FONT_SIZE


def _apply_field(page: fitz.Page, placement: _Placement, mode: str, font: fitz.Font) -> None:
    source = placement.source_rect
    if mode == "anchor":
        redact_rect = _anchor_slot(page, source)
        insert_x = redact_rect.x0 + 2
        available = max(0.0, redact_rect.width - 4)
        fontsize = _fitted_size(font, placement.value, placement.fontsize, available)
    else:
        redact_rect = _clip_rect(
            page,
            fitz.Rect(source.x0 - 0.6, source.y0 - 0.6, source.x1 + 0.8, source.y1 + 0.8),
        )
        insert_x = source.x0
        fontsize = placement.fontsize

    page.add_redact_annot(redact_rect, fill=(1, 1, 1))
    _apply_redactions(page)
    point = fitz.Point(insert_x, source.y1 - max(1.0, placement.fontsize * 0.2))
    page.insert_text(
        point,
        placement.value,
        fontname=_FONT_NAME,
        fontsize=fontsize,
        color=(0, 0, 0),
        overlay=True,
    )


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
    graphics = getattr(fitz, "PDF_REDACT_LINE_ART_REMOVE_IF_COVERED", None)
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
        "Не найден шрифт с кириллицей (DejaVuSans.ttf).",
        status_code=500,
    )
