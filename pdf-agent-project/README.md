# Local PDF form editor

Fills parent and child name and passport/certificate numbers into a PDF on this machine. The file and the personal fields stay in memory for the request and are not stored or sent to an external service.

Two modes:

- **Якоря** — find a label such as `ФИО родителя:` and write the value about 300px to its right.
- **Рыбы** — find a placeholder such as `[ФИО_РОДИТЕЛЯ]` and replace it.

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
