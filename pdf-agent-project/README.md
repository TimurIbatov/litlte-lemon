# Local PDF form editor

Fills a worker affidavit on this machine: the worker’s name and passport, the father’s and mother’s surname, given name, and passport, and the spouse’s and both children’s names and passports. The file and the personal fields stay in memory for the request and are not stored or sent to an external service.

The form opens in replace mode with the affidavit already selected (`frontend/public/affidavit-artikov-zhasurbek.pdf`). Drag and drop or choose another PDF to replace it. Data fields start empty. Search strings stay in the program and are not shown. The children’s passport cells are blank, so those values are written into the empty cell to the left of each child’s surname. A hyphen in a parent, spouse, or child name, passport, or birth date is written into that cell. For a spouse or child name, one hyphen fills both the surname and the given name. Printed birth dates are the father’s `12.02.1952`, the mother’s `11.12.1956`, the spouse’s `15.12.1994`, the first child’s `23.05.2014`, and the second child’s `22.01.2018`. This affidavit has no worker birth date. Replacement text is Liberation Serif Bold, on the original baseline. Anchor mode is still available; on the family table a 300px box to the right of a row label also covers the next columns.

Two modes:

- **Якоря** — find a label such as `Ф.И.О. работника:` and write the value about 300px to its right.
- **Рыбы** — find the printed text, for example the worker’s full name, and replace every whole occurrence.

## Run

Use two terminals.

### Backend (http://localhost:8000)

```bash
cd pdf-agent-project/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (http://localhost:5173)

```bash
cd pdf-agent-project/frontend
npm install
npm run dev
```

Open http://localhost:5173. The page calls `POST http://localhost:8000/api/process-pdf`.
