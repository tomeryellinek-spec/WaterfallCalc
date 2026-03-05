import os
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from document_parser import parse_with_claude, parse_excel, parse_cap_table_excel

load_dotenv()

app = FastAPI(title="Waterfall Calculator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv", ".docx", ".doc"}


@app.post("/api/parse-document")
async def parse_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    content = await file.read()

    try:
        if ext in (".xlsx", ".xls") and document_type == "cap_table":
            direct = parse_cap_table_excel(content)
            if direct:
                return {"documentType": document_type, "data": direct, "rawText": "Parsed directly from Excel structure"}
            text_content = parse_excel(content, ext)
            result = await parse_with_claude(text_content, document_type, is_text=True)
        elif ext in (".xlsx", ".xls"):
            text_content = parse_excel(content, ext)
            result = await parse_with_claude(text_content, document_type, is_text=True)
        elif ext == ".csv":
            text_content = content.decode("utf-8", errors="replace")
            result = await parse_with_claude(text_content, document_type, is_text=True)
        elif ext == ".pdf":
            b64 = base64.standard_b64encode(content).decode("utf-8")
            result = await parse_with_claude(b64, document_type, is_text=False, media_type="application/pdf")
        else:
            text_content = content.decode("utf-8", errors="replace")
            result = await parse_with_claude(text_content, document_type, is_text=True)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse document: {str(e)}")

    return result


@app.get("/api/health")
async def health():
    return {"status": "ok"}
