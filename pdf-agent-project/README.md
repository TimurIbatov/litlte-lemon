# Local PDF form editor

Fills a worker affidavit on this machine: the worker’s name and passport, the father’s and mother’s surname, given name, and passport, and the spouse’s and both children’s names and passports. The file and the personal fields stay in memory for the request and are not stored or sent to an external service.

The form opens in replace mode. Search strings match the text printed in the affidavit. The children’s passport cells are blank, so those values are written into the empty cell to the left of each child’s surname. Anchor mode is still available; on the family table a 300px box to the right of a row label also covers the next columns.

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
