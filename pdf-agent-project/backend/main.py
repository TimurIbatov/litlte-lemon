"""Local PDF form API. Personal data stays in the request memory."""

from __future__ import annotations

import json
import logging
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pdf_processor import PdfProcessError, process_pdf_bytes

logger = logging.getLogger("pdf_editor")

MAX_PDF_BYTES = 40 * 1024 * 1024

app = FastAPI(title="Local PDF form editor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/api/process-pdf")
async def process_pdf(
    file: UploadFile | None = File(default=None),
    jsonData: str | None = Form(default=None),
) -> StreamingResponse:
    if file is None or not (file.filename or "").strip():
        raise HTTPException(status_code=400, detail="Файл PDF не передан.")
    if jsonData is None or not jsonData.strip():
        raise HTTPException(status_code=400, detail="Поле jsonData не передано.")

    try:
        raw = await file.read()
    finally:
        await file.close()

    if not raw:
        raise HTTPException(status_code=400, detail="Файл PDF пуст.")
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=400,
            detail="PDF больше 40 МБ. Выберите файл меньшего размера.",
        )
    if not raw.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Файл не является PDF.")

    try:
        payload = json.loads(jsonData)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Некорректный JSON в поле jsonData.")

    try:
        pdf_bytes = process_pdf_bytes(raw, payload)
    except PdfProcessError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        logger.error("pdf processing failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Не удалось обработать PDF.") from exc

    filename = _download_name(file.filename or "document.pdf")
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )


def _download_name(original: str) -> str:
    stem = original.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].strip() or "document.pdf"
    if stem.lower().endswith(".pdf"):
        stem = stem[:-4]
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in stem) or "document"
    return f"{safe}-filled.pdf"
