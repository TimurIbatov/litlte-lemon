import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000/api/process-pdf";

type Mode = "anchor" | "replace";
type FieldKey =
  | "workerFio"
  | "workerPassport"
  | "fatherSurname"
  | "fatherGiven"
  | "fatherPassport"
  | "motherSurname"
  | "motherGiven"
  | "motherPassport";
type SearchMap = Record<FieldKey, string>;

const DEFAULT_ANCHORS: SearchMap = {
  workerFio: "Ф.И.О. работника:",
  workerPassport: "Номер паспорта:",
  fatherSurname: "Отец",
  fatherGiven: "Father",
  fatherPassport: "AE3211900",
  motherSurname: "Мать",
  motherGiven: "Mother",
  motherPassport: "AE3220287",
};

const DEFAULT_DUMMIES: SearchMap = {
  workerFio: "ARTIKOV JASURBEK",
  workerPassport: "FA2807567",
  fatherSurname: "ORTIQOV",
  fatherGiven: "ALIJON",
  fatherPassport: "AE3211900",
  motherSurname: "ARTIKOVA",
  motherGiven: "RAXNAMO",
  motherPassport: "AE3220287",
};

const DATA_FIELDS: { key: FieldKey; label: string; placeholder: string; group: string }[] = [
  { key: "workerFio", label: "ФИО работника", placeholder: "фамилия и имя", group: "Работник" },
  {
    key: "workerPassport",
    label: "Паспорт работника (серия, номер)",
    placeholder: "серия и номер",
    group: "Работник",
  },
  { key: "fatherSurname", label: "Фамилия отца", placeholder: "фамилия", group: "Отец" },
  { key: "fatherGiven", label: "Имя отца", placeholder: "имя", group: "Отец" },
  { key: "fatherPassport", label: "Паспорт отца", placeholder: "серия и номер", group: "Отец" },
  { key: "motherSurname", label: "Фамилия матери", placeholder: "фамилия", group: "Мать" },
  { key: "motherGiven", label: "Имя матери", placeholder: "имя", group: "Мать" },
  { key: "motherPassport", label: "Паспорт матери", placeholder: "серия и номер", group: "Мать" },
];

const GROUPS = ["Работник", "Отец", "Мать"] as const;

const SEARCH_LABELS: Record<FieldKey, string> = {
  workerFio: "ФИО работника",
  workerPassport: "Паспорт работника",
  fatherSurname: "Фамилия отца",
  fatherGiven: "Имя отца",
  fatherPassport: "Паспорт отца",
  motherSurname: "Фамилия матери",
  motherGiven: "Имя матери",
  motherPassport: "Паспорт матери",
};

const EMPTY_VALUES: SearchMap = {
  workerFio: "",
  workerPassport: "",
  fatherSurname: "",
  fatherGiven: "",
  fatherPassport: "",
  motherSurname: "",
  motherGiven: "",
  motherPassport: "",
};

const inputClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function filledName(name: string): string {
  const trimmed = name.trim() || "document.pdf";
  if (trimmed.toLowerCase().endsWith(".pdf")) {
    return `${trimmed.slice(0, -4)}-filled.pdf`;
  }
  return `${trimmed}-filled.pdf`;
}

async function readDetail(data: unknown): Promise<string | null> {
  let text = "";
  if (typeof data === "string") {
    text = data;
  } else if (data instanceof Blob) {
    text = await data.text();
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return String(item);
        })
        .join("; ");
    }
  } catch {
    return text.slice(0, 300);
  }
  return text.slice(0, 300);
}

async function errorMessage(error: unknown): Promise<string> {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Сервер недоступен. Запустите backend на http://localhost:8000.";
    }
    const detail = await readDetail(error.response.data);
    if (detail) return detail;
    return `Сервер вернул ошибку ${error.response.status}.`;
  }
  return "Не удалось сформировать документ.";
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function App() {
  const [dark, setDark] = useState(prefersDark);
  const [values, setValues] = useState<SearchMap>(EMPTY_VALUES);
  const [mode, setMode] = useState<Mode>("replace");
  const [anchors, setAnchors] = useState<SearchMap>(DEFAULT_ANCHORS);
  const [dummies, setDummies] = useState<SearchMap>(DEFAULT_DUMMIES);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function setValue(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const dataReady = DATA_FIELDS.every((field) => values[field.key].trim().length > 0);
  const canSubmit = Boolean(file) && dataReady && !loading;
  const searchMap = mode === "anchor" ? anchors : dummies;

  async function acceptFile(next: File | null) {
    if (!next) return;
    if (!isPdfFile(next)) {
      setFile(null);
      setResult(null);
      setFileError("Нужен файл PDF.");
      return;
    }
    if (next.size === 0) {
      setFile(null);
      setResult(null);
      setFileError("Файл PDF пуст.");
      return;
    }
    const header = new Uint8Array(await next.slice(0, 5).arrayBuffer());
    const signature = String.fromCharCode(...header);
    if (!signature.startsWith("%PDF")) {
      setFile(null);
      setResult(null);
      setFileError("Файл не похож на PDF.");
      return;
    }
    setFile(next);
    setFileError(null);
    setResult(null);
    setError(null);
  }

  function updateSearch(key: FieldKey, value: string) {
    if (mode === "anchor") {
      setAnchors((current) => ({ ...current, [key]: value }));
    } else {
      setDummies((current) => ({ ...current, [key]: value }));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      ...Object.fromEntries(
        DATA_FIELDS.map((field) => [field.key, values[field.key].trim()]),
      ),
      mode,
      anchors,
      dummies,
    };
    const body = new FormData();
    body.append("file", file);
    body.append("jsonData", JSON.stringify(payload));

    try {
      const response = await axios.post<Blob>(API_URL, body, {
        responseType: "blob",
        timeout: 120000,
      });
      const blob = response.data;
      const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      const signature = String.fromCharCode(...header);
      if (!signature.startsWith("%PDF")) {
        setError("Сервер вернул ответ, который не является PDF.");
        return;
      }
      setResult({ blob, filename: filledName(file.name) });
    } catch (submitError) {
      setError(await errorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Только на этом компьютере
          </p>
          <h1 className="display mt-2 text-3xl text-ink sm:text-4xl">Локальный редактор PDF</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Меняет в аффидавите ФИО и паспорт работника и данные родителей — только там, где
            форма их уже печатает. Файл обрабатывается в памяти и никуда не отправляется.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDark((value) => !value)}
          className="shrink-0 rounded-full border border-line bg-raise px-3 py-1.5 text-sm text-ink shadow-sm hover:border-accent"
        >
          {dark ? "Светлая" : "Тёмная"}
        </button>
      </header>

      <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-raise p-5 shadow-card sm:p-6">
          {GROUPS.map((group, index) => (
            <FieldGroup key={group} title={group} className={index === 0 ? "" : "mt-6"}>
              {DATA_FIELDS.filter((field) => field.group === group).map((field) => (
                <TextField
                  key={field.key}
                  id={field.key}
                  label={field.label}
                  value={values[field.key]}
                  placeholder={field.placeholder}
                  onChange={(value) => setValue(field.key, value)}
                />
              ))}
            </FieldGroup>
          ))}

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-ink">Режим заполнения</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ModeOption
                checked={mode === "anchor"}
                title="Вставка по ключевым словам (Якоря)"
                onSelect={() => setMode("anchor")}
              />
              <ModeOption
                checked={mode === "replace"}
                title="Замена текста (Рыбы)"
                onSelect={() => setMode("replace")}
              />
            </div>
          </fieldset>

          <details className="group mt-4 rounded-xl border border-line bg-bg/70">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink">
              <span className="flex items-center justify-between gap-3">
                Строки поиска
                <span className="text-xs text-muted group-open:hidden">Показать</span>
                <span className="hidden text-xs text-muted group-open:inline">Скрыть</span>
              </span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-xs leading-5 text-muted">
                {mode === "anchor"
                  ? "Якорь — подпись в PDF. Значение будет вписано справа от неё. Для таблицы семьи это заденет соседние колонки."
                  : "Рыба — текст, который уже напечатан в аффидавите. Заменяются все целые вхождения, без чужих фамилий."}
              </p>
              {DATA_FIELDS.map((field) => (
                <label key={`${mode}-${field.key}`} htmlFor={`search-${field.key}`} className="block text-sm">
                  <span className="mb-1 block text-muted">
                    {mode === "anchor" ? "Якорь" : "Рыба"}: {SEARCH_LABELS[field.key]}
                  </span>
                  <input
                    id={`search-${field.key}`}
                    value={searchMap[field.key]}
                    onChange={(event) => updateSearch(field.key, event.target.value)}
                    spellCheck={false}
                    className={`${inputClass} font-mono text-[13px]`}
                  />
                </label>
              ))}
            </div>
          </details>
        </section>

        <section className="rounded-2xl border border-line bg-raise p-5 shadow-card sm:p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Документ</h2>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={`mt-3 rounded-2xl border-2 border-dashed px-4 py-6 transition ${
              dragging ? "border-accent bg-accent/5" : "border-line bg-bg/50"
            }`}
          >
            <p className="text-sm font-medium text-ink">Перетащите PDF сюда или выберите файл</p>
            <p className="mt-1 text-xs text-muted">Только PDF. Файл не сохраняется на сервере.</p>
            <label className="relative mt-4 inline-flex cursor-pointer items-center">
              <span className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accentink">
                Выбрать PDF
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Файл PDF"
                onChange={(event) => {
                  void acceptFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            {file && (
              <p className="mt-4 rounded-lg border border-line bg-raise px-3 py-2 text-sm text-ink">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted"> · {formatBytes(file.size)}</span>
              </p>
            )}
            {fileError && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {fileError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accentink transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading && (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden="true"
              />
            )}
            {loading ? "Формируем документ…" : "Сформировать документ"}
          </button>
          {!canSubmit && !loading && (
            <p className="mt-2 text-center text-xs text-muted">
              Кнопка включится, когда загружен PDF и заполнены все поля. Новые значения вводите сами: текущий текст формы не подставляется.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {result && !loading && (
            <button
              type="button"
              onClick={download}
              className="mt-4 w-full rounded-xl border border-accent px-4 py-3 text-base font-semibold text-accent hover:bg-accent/10"
            >
              Скачать {result.filename}
            </button>
          )}
        </section>
      </form>
    </div>
  );
}

function FieldGroup({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        id={id}
        name={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={400}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function ModeOption({
  checked,
  title,
  onSelect,
}: {
  checked: boolean;
  title: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm leading-5 ${
        checked ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"
      }`}
    >
      <input
        type="radio"
        name="mode"
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-accent"
      />
      <span>{title}</span>
    </label>
  );
}
