import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FillError, fillAffidavit } from "./fillPdf";
import type { FieldKey as FillFieldKey } from "./fillPdf";

const BUNDLED_PDF_URL = `${import.meta.env.BASE_URL}affidavit-artikov-zhasurbek.pdf`;
const BUNDLED_PDF_NAME = "affidavit-artikov-zhasurbek.pdf";

type FieldKey =
  | "workerFio"
  | "workerPassport"
  | "workerDob"
  | "fatherSurname"
  | "fatherGiven"
  | "fatherPassport"
  | "fatherDob"
  | "motherSurname"
  | "motherGiven"
  | "motherPassport"
  | "motherDob"
  | "spouseFio"
  | "spousePassport"
  | "spouseDob"
  | "child1Fio"
  | "child1Passport"
  | "child1Dob"
  | "child2Fio"
  | "child2Passport"
  | "child2Dob";
type SearchMap = Record<FieldKey, string>;

const DEFAULT_DUMMIES: SearchMap = {
  workerFio: "ARTIKOV JASURBEK",
  workerPassport: "FA2807567",
  workerDob: "",
  fatherSurname: "ORTIQOV",
  fatherGiven: "ALIJON",
  fatherPassport: "AE3211900",
  fatherDob: "12.02.1952",
  motherSurname: "ARTIKOVA",
  motherGiven: "RAXNAMO",
  motherPassport: "AE3220287",
  motherDob: "11.12.1956",
  spouseFio: "ARTIQOVA MARHABO",
  spousePassport: "AD4559629",
  spouseDob: "15.12.1994",
  child1Fio: "ALIJONOV ABDUSALOM",
  child1Passport: "",
  child1Dob: "23.05.2014",
  child2Fio: "ALIJONOVA XUMORAXON",
  child2Passport: "",
  child2Dob: "22.01.2018",
};

const DATA_FIELDS: {
  key: FieldKey;
  label: string;
  placeholder: string;
  group: string;
  hint?: string;
}[] = [
  { key: "workerFio", label: "ФИО работника", placeholder: "фамилия и имя", group: "Работник" },
  {
    key: "workerPassport",
    label: "Паспорт работника (серия, номер)",
    placeholder: "серия и номер",
    group: "Работник",
  },
  {
    key: "workerDob",
    label: "Дата рождения работника",
    placeholder: "ДД.ММ.ГГГГ или -",
    group: "Работник",
    hint: "В этом бланке даты рождения работника нет, поэтому поле не впечатывается.",
  },
  { key: "fatherSurname", label: "Фамилия отца", placeholder: "фамилия или -", group: "Отец" },
  { key: "fatherGiven", label: "Имя отца", placeholder: "имя или -", group: "Отец" },
  { key: "fatherPassport", label: "Паспорт отца", placeholder: "серия и номер или -", group: "Отец" },
  { key: "fatherDob", label: "Дата рождения отца", placeholder: "ДД.ММ.ГГГГ или -", group: "Отец" },
  { key: "motherSurname", label: "Фамилия матери", placeholder: "фамилия или -", group: "Мать" },
  { key: "motherGiven", label: "Имя матери", placeholder: "имя или -", group: "Мать" },
  {
    key: "motherPassport",
    label: "Паспорт матери",
    placeholder: "серия и номер или -",
    group: "Мать",
  },
  { key: "motherDob", label: "Дата рождения матери", placeholder: "ДД.ММ.ГГГГ или -", group: "Мать" },
  { key: "spouseFio", label: "ФИО супруги", placeholder: "фамилия имя или -", group: "Супруга" },
  {
    key: "spousePassport",
    label: "Паспорт супруги",
    placeholder: "серия и номер или -",
    group: "Супруга",
  },
  { key: "spouseDob", label: "Дата рождения супруги", placeholder: "ДД.ММ.ГГГГ или -", group: "Супруга" },
  { key: "child1Fio", label: "ФИО ребенка 1", placeholder: "фамилия имя или -", group: "Ребенок 1" },
  {
    key: "child1Passport",
    label: "Паспорт ребенка 1",
    placeholder: "серия и номер или -",
    group: "Ребенок 1",
  },
  {
    key: "child1Dob",
    label: "Дата рождения ребенка 1",
    placeholder: "ДД.ММ.ГГГГ или -",
    group: "Ребенок 1",
  },
  { key: "child2Fio", label: "ФИО ребенка 2", placeholder: "фамилия имя или -", group: "Ребенок 2" },
  {
    key: "child2Passport",
    label: "Паспорт ребенка 2",
    placeholder: "серия и номер или -",
    group: "Ребенок 2",
  },
  {
    key: "child2Dob",
    label: "Дата рождения ребенка 2",
    placeholder: "ДД.ММ.ГГГГ или -",
    group: "Ребенок 2",
  },
];

const GROUPS = ["Работник", "Отец", "Мать", "Супруга", "Ребенок 1", "Ребенок 2"] as const;

const EMPTY_VALUES: SearchMap = {
  workerFio: "",
  workerPassport: "",
  workerDob: "",
  fatherSurname: "",
  fatherGiven: "",
  fatherPassport: "",
  fatherDob: "",
  motherSurname: "",
  motherGiven: "",
  motherPassport: "",
  motherDob: "",
  spouseFio: "",
  spousePassport: "",
  spouseDob: "",
  child1Fio: "",
  child1Passport: "",
  child1Dob: "",
  child2Fio: "",
  child2Passport: "",
  child2Dob: "",
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

function workerPdfName(workerName: string): string {
  const stem = workerName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/g, "");
  return `${stem || "document"}.pdf`;
}

function errorMessage(error: unknown): string {
  if (error instanceof FillError) return error.message;
  return "Не удалось сформировать документ.";
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function App() {
  const [dark, setDark] = useState(prefersDark);
  const [values, setValues] = useState<SearchMap>(EMPTY_VALUES);
  const [file, setFile] = useState<File | null>(null);
  const [fileSource, setFileSource] = useState<"bundled" | "upload" | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const pickedByUser = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    async function loadBundled() {
      try {
        const response = await fetch(BUNDLED_PDF_URL);
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const blob = await response.blob();
        if (cancelled || pickedByUser.current) return;
        const bundled = new File([blob], BUNDLED_PDF_NAME, { type: "application/pdf" });
        await acceptFile(bundled, "bundled");
      } catch {
        if (!cancelled && !pickedByUser.current) {
          setFileError("Не удалось открыть встроенный аффидавит.");
        }
      }
    }
    void loadBundled();
    return () => {
      cancelled = true;
    };
  }, []);

  function setValue(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const dataReady = DATA_FIELDS.every((field) => values[field.key].trim().length > 0);
  const canSubmit = Boolean(file) && dataReady && !loading;

  async function acceptFile(next: File | null, source: "bundled" | "upload" = "upload") {
    if (!next) return;
    if (source === "upload") pickedByUser.current = true;
    if (!isPdfFile(next)) {
      setFileError("Нужен файл PDF.");
      return;
    }
    if (next.size === 0) {
      setFileError("Файл PDF пуст.");
      return;
    }
    const header = new Uint8Array(await next.slice(0, 5).arrayBuffer());
    const signature = String.fromCharCode(...header);
    if (!signature.startsWith("%PDF")) {
      setFileError("Файл не похож на PDF.");
      return;
    }
    if (source === "bundled" && pickedByUser.current) return;
    setFile(next);
    setFileSource(source);
    setFileError(null);
    setResult(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const filled = await fillAffidavit(
        bytes,
        values as Record<FillFieldKey, string>,
        DEFAULT_DUMMIES as Record<FillFieldKey, string>,
      );
      const copy = new Uint8Array(filled.byteLength);
      copy.set(filled);
      const blob = new Blob([copy.buffer], { type: "application/pdf" });
      setResult({ blob, filename: workerPdfName(values.workerFio) });
    } catch (submitError) {
      setError(errorMessage(submitError));
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
            Меняет в аффидавите ФИО, паспорт и дату рождения. Для родителей, супруги и детей
            «-» вписывается в ячейку. Всё считается в браузере и никуда не отправляется.
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
                  hint={field.hint}
                  onChange={(value) => setValue(field.key, value)}
                />
              ))}
            </FieldGroup>
          ))}

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
            <p className="text-sm font-medium text-ink">
              {file
                ? "Перетащите другой PDF, чтобы заменить выбранный"
                : "Открываем встроенный аффидавит…"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Бланк уже приложен. Другой PDF — по желанию. Файл остаётся в браузере.
            </p>
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
                {fileSource === "bundled" && (
                  <span className="mt-1 block text-xs text-muted">Встроенный бланк</span>
                )}
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
              {file
                ? "Кнопка включится, когда заполнены все поля. «-» в полях семьи и в датах тоже значение."
                : "Кнопка включится, когда бланк открыт и заполнены все поля."}
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
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
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
      {hint && <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  );
}

