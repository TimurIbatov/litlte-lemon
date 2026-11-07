import fontkit from "@pdf-lib/fontkit";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  concatTransformationMatrix,
  decodePDFRawStream,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export type FieldKey =
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

const FIELD_KEYS: FieldKey[] = [
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
];

const FIELD_TITLES: Record<FieldKey, string> = {
  workerFio: "ФИО работника",
  workerPassport: "Паспорт работника",
  workerDob: "Дата рождения работника",
  fatherSurname: "Фамилия отца",
  fatherGiven: "Имя отца",
  fatherPassport: "Паспорт отца",
  fatherDob: "Дата рождения отца",
  motherSurname: "Фамилия матери",
  motherGiven: "Имя матери",
  motherPassport: "Паспорт матери",
  motherDob: "Дата рождения матери",
  spouseFio: "ФИО супруги",
  spousePassport: "Паспорт супруги",
  spouseDob: "Дата рождения супруги",
  child1Fio: "ФИО ребенка 1",
  child1Passport: "Паспорт ребенка 1",
  child1Dob: "Дата рождения ребенка 1",
  child2Fio: "ФИО ребенка 2",
  child2Passport: "Паспорт ребенка 2",
  child2Dob: "Дата рождения ребенка 2",
};

const PAIR_FIO = new Set<FieldKey>(["spouseFio", "child1Fio", "child2Fio"]);
const BLANK_PASSPORT: Partial<Record<FieldKey, FieldKey>> = {
  child1Passport: "child1Fio",
  child2Passport: "child2Fio",
};
const NO_PRINTED_DATE = new Set<FieldKey>(["workerDob"]);
const DASHES = new Set(["-", "–", "—", "−", "‑"]);
const PASSPORT = /^[A-Z]{1,3}\d{5,}$/;

type Token = {
  raw: string;
  norm: string;
  page: number;
  x0: number;
  x1: number;
  baseline: number;
  size: number;
};

type Placement = {
  page: number;
  x: number;
  baseline: number;
  size: number;
  width: number;
  room: number;
  value: string;
  prefix: string;
  fitWidth: number;
  cover: boolean;
};

export class FillError extends Error {}

function isDash(text: string): boolean {
  return DASHES.has(text);
}

function normToken(text: string): string {
  return text
    .replace(/№/g, " ")
    .replace(/[.,;:"'«»()[\]]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function splitFio(text: string, title: string): [string, string] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new FillError(`Поле «${title}» нужно в виде «фамилия имя».`);
  }
  return [parts[0], parts.slice(1).join(" ")];
}

function pairValues(value: string, title: string): [string, string] {
  if (isDash(value)) return ["-", "-"];
  return splitFio(value, title);
}

function sameLine(a: Token, b: Token): boolean {
  return Math.abs(a.baseline - b.baseline) <= Math.max(3, 0.4 * Math.max(a.size, b.size));
}

function findSequences(tokens: Token[], needle: string): Token[][] {
  const parts = normToken(needle).split(" ").filter(Boolean);
  if (!parts.length) return [];
  const hits: Token[][] = [];
  for (let start = 0; start < tokens.length; start += 1) {
    if (tokens[start].norm !== parts[0]) continue;
    const sequence = [tokens[start]];
    let previous = tokens[start];
    let part = 1;
    for (let next = start + 1; next < tokens.length && part < parts.length; next += 1) {
      const token = tokens[next];
      if (token.page !== previous.page || !sameLine(previous, token)) break;
      if (token.x0 > previous.x1 + 20) break;
      if (token.norm !== parts[part]) break;
      sequence.push(token);
      previous = token;
      part += 1;
    }
    if (part === parts.length) hits.push(sequence);
  }
  return hits;
}

function sequenceBox(sequence: Token[]): { x0: number; x1: number; baseline: number; size: number } {
  const x0 = Math.min(...sequence.map((token) => token.x0));
  const x1 = Math.max(...sequence.map((token) => token.x1));
  return { x0, x1, baseline: sequence[0].baseline, size: sequence[0].size };
}

function prefixOf(sequence: Token[], needle: string): string {
  if (needle.startsWith("№")) return "";
  return sequence.some((token) => token.raw.startsWith("№")) ? "№" : "";
}

function roomWidth(tokens: Token[], box: { page: number; x0: number; x1: number; baseline: number; size: number }): number {
  let limit = 560;
  for (const token of tokens) {
    if (token.page !== box.page || token.x0 <= box.x1 + 0.4) continue;
    if (Math.abs(token.baseline - box.baseline) > Math.max(3, 0.4 * box.size)) continue;
    limit = Math.min(limit, token.x0 - 2);
  }
  return Math.max(box.x1 - box.x0, limit - box.x0);
}

function placementsForNeedle(
  tokens: Token[],
  needle: string,
  value: string,
  title: string,
  fitToSpan: boolean,
): Placement[] {
  const groups = findSequences(tokens, needle);
  if (!groups.length) {
    throw new FillError(`В документе не найдена строка «${needle}» (${title}).`);
  }
  return groups.map((sequence) => {
    const box = sequenceBox(sequence);
    const width = box.x1 - box.x0;
    const room = roomWidth(tokens, { page: sequence[0].page, ...box });
    return {
      page: sequence[0].page,
      x: box.x0,
      baseline: box.baseline,
      size: box.size,
      width,
      room: Math.min(width, room),
      value,
      prefix: prefixOf(sequence, needle),
      fitWidth: fitToSpan ? width : 0,
      cover: true,
    };
  });
}

function isPassportToken(token: Token): boolean {
  const bare = token.raw.replace(/^№/, "").replace(/[.,;:]/g, "");
  return PASSPORT.test(bare);
}

function blankPassportPlacements(tokens: Token[], surname: string, value: string, title: string): Placement[] {
  const rows = findSequences(tokens, surname);
  if (!rows.length) {
    throw new FillError(`В документе не найдена строка «${surname}» (${title}).`);
  }
  return rows.map((sequence) => {
    const box = sequenceBox(sequence);
    const left = tokens
      .filter(
        (token) =>
          token.page === sequence[0].page &&
          isPassportToken(token) &&
          token.x1 < box.x0 - 8 &&
          Math.abs(token.baseline - box.baseline) <= 90,
      )
      .map((token) => token.x0)
      .sort((a, b) => a - b);
    const x0 = left.length ? left[Math.floor(left.length / 2)] : Math.max(8, box.x0 - 94);
    const x1 = Math.min(box.x0 - 8, x0 + 90);
    if (x1 - x0 < 24) {
      throw new FillError(`Не удалось найти пустую ячейку паспорта в строке «${surname}» (${title}).`);
    }
    return {
      page: sequence[0].page,
      x: x0,
      baseline: box.baseline,
      size: box.size,
      width: x1 - x0,
      room: x1 - x0,
      value,
      prefix: "",
      fitWidth: 0,
      cover: false,
    };
  });
}

function collectPlacements(tokens: Token[], values: SearchMap, dummies: SearchMap): Placement[] {
  const placements: Placement[] = [];
  for (const key of FIELD_KEYS) {
    const title = FIELD_TITLES[key];
    const value = values[key];
    const needle = dummies[key];
    if (NO_PRINTED_DATE.has(key) && !needle) continue;
    const blankOf = BLANK_PASSPORT[key];
    if (blankOf && !needle) {
      const [surname] = splitFio(dummies[blankOf], FIELD_TITLES[blankOf]);
      placements.push(...blankPassportPlacements(tokens, surname, value, title));
      continue;
    }
    if (PAIR_FIO.has(key)) {
      const [surnameNeedle, givenNeedle] = splitFio(needle, title);
      const [surnameValue, givenValue] = pairValues(value, title);
      placements.push(...placementsForNeedle(tokens, surnameNeedle, surnameValue, title, false));
      placements.push(...placementsForNeedle(tokens, givenNeedle, givenValue, title, false));
      continue;
    }
    placements.push(...placementsForNeedle(tokens, needle, value, title, key === "workerFio"));
  }
  return placements;
}

function cover(page: PDFPage, placement: Placement, size: number): void {
  const height = size * 1.05;
  const bottom = placement.baseline - size * 0.25;
  page.drawRectangle({
    x: placement.x,
    y: bottom,
    width: Math.max(placement.width, 1),
    height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

function paintInside(
  page: PDFPage,
  text: string,
  x: number,
  baseline: number,
  size: number,
  font: PDFFont,
  maxWidth: number,
): void {
  const natural = font.widthOfTextAtSize(text, size);
  if (natural <= maxWidth + 0.4 || natural <= 0) {
    page.drawText(text, { x, y: baseline, size, font, color: rgb(0, 0, 0) });
    return;
  }
  const fitted = Math.max(8, size * (maxWidth / natural));
  const fittedWidth = font.widthOfTextAtSize(text, fitted);
  if (fittedWidth <= maxWidth + 0.4) {
    page.drawText(text, { x, y: baseline, size: fitted, font, color: rgb(0, 0, 0) });
    return;
  }
  const hscale = maxWidth / fittedWidth;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(hscale, 0, 0, 1, x * (1 - hscale), 0));
  page.drawText(text, { x, y: baseline, size: fitted, font, color: rgb(0, 0, 0) });
  page.pushOperators(popGraphicsState());
}

function paint(
  page: PDFPage,
  text: string,
  x: number,
  baseline: number,
  size: number,
  font: PDFFont,
  fitWidth: number,
): void {
  if (!text) return;
  if (fitWidth <= 1) {
    page.drawText(text, { x, y: baseline, size, font, color: rgb(0, 0, 0) });
    return;
  }
  const chars = Array.from(text);
  const widths = chars.map((ch) => Math.max(0, font.widthOfTextAtSize(ch, size)));
  const natural = widths.reduce((total, width) => total + width, 0);
  if (natural <= 0) return;
  if (natural > fitWidth + 0.4) {
    const hscale = fitWidth / natural;
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(hscale, 0, 0, 1, x * (1 - hscale), 0),
    );
    page.drawText(text, { x, y: baseline, size, font, color: rgb(0, 0, 0) });
    page.pushOperators(popGraphicsState());
    return;
  }
  const gaps = Math.max(1, chars.length - 1);
  const pad = (fitWidth - natural) / gaps;
  let cursor = x;
  chars.forEach((ch, index) => {
    if (ch !== " ") {
      page.drawText(ch, { x: cursor, y: baseline, size, font, color: rgb(0, 0, 0) });
    }
    cursor += widths[index] + pad;
  });
}

async function readTokens(doc: PDFDocumentProxy): Promise<Token[]> {
  if (doc.numPages === 0) {
    throw new FillError("PDF пуст: в файле нет страниц.");
  }
  const tokens: Token[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const glyphs = glyphGroups(await page.getOperatorList()).flat();
    tokens.push(...tokensFromGlyphs(glyphs, pageNumber - 1));
  }
  tokens.sort((a, b) => a.page - b.page || b.baseline - a.baseline || a.x0 - b.x0);
  return tokens;
}

function valuesFrom(input: SearchMap): SearchMap {
  const values = {} as SearchMap;
  for (const key of FIELD_KEYS) {
    const raw = input[key];
    const title = FIELD_TITLES[key];
    if (typeof raw !== "string" || !raw.trim()) {
      throw new FillError(`Заполните поле «${title}».`);
    }
    const text = isDash(raw.trim()) ? "-" : raw.trim();
    if (text.length > 400) {
      throw new FillError(`Поле «${title}» длиннее 400 символов.`);
    }
    values[key] = text;
  }
  return values;
}

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

function loadFontBytes(): Promise<ArrayBuffer> {
  if (!fontBytesPromise) {
    const url = `${import.meta.env.BASE_URL}fonts/LiberationSerif-Bold.ttf`;
    fontBytesPromise = fetch(url).then((response) => {
      if (!response.ok) {
        fontBytesPromise = null;
        throw new FillError("Не найден шрифт Liberation Serif Bold.");
      }
      return response.arrayBuffer();
    });
  }
  return fontBytesPromise;
}

const SHOW_TEXT = 44;

type DrawnGlyph = { x: number; y: number; w: number; size: number; unicode: string };
type StreamToken = { kind: "str" | "op" | "other"; start: number; end: number; value: string };

function latin1(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return text;
}

function fromLatin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 255;
  return bytes;
}

function tokenizeContent(raw: string): StreamToken[] {
  const tokens: StreamToken[] = [];
  let index = 0;
  while (index < raw.length) {
    const start = index;
    const char = raw[index];
    if (" \n\r\t\0\f".includes(char)) {
      index += 1;
      continue;
    }
    if (char === "%") {
      while (index < raw.length && raw[index] !== "\n" && raw[index] !== "\r") index += 1;
      continue;
    }
    if (char === "(") {
      index += 1;
      let depth = 1;
      while (index < raw.length && depth) {
        if (raw[index] === "\\") {
          index += 2;
          continue;
        }
        if (raw[index] === "(") depth += 1;
        else if (raw[index] === ")") depth -= 1;
        index += 1;
      }
      tokens.push({ kind: "str", start, end: index, value: "" });
      continue;
    }
    if (char === "<" && raw[index + 1] !== "<") {
      index = raw.indexOf(">", index);
      if (index < 0) break;
      index += 1;
      tokens.push({ kind: "str", start, end: index, value: "" });
      continue;
    }
    if (char === "<" || char === ">" || char === "[" || char === "]") {
      index += char === "<" || char === ">" ? 2 : 1;
      tokens.push({ kind: "op", start, end: index, value: raw.slice(start, index) });
      continue;
    }
    if (char === "/") {
      index += 1;
      while (index < raw.length && !" \n\r\t[]()<>/%".includes(raw[index])) index += 1;
      tokens.push({ kind: "other", start, end: index, value: raw.slice(start, index) });
      continue;
    }
    if ("+-0123456789.".includes(char)) {
      index += 1;
      while (index < raw.length && "0123456789.".includes(raw[index])) index += 1;
      tokens.push({ kind: "other", start, end: index, value: raw.slice(start, index) });
      continue;
    }
    index += 1;
    while (index < raw.length && /[A-Za-z*'"]/.test(raw[index])) index += 1;
    tokens.push({ kind: "op", start, end: index, value: raw.slice(start, index) });
  }
  return tokens;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function asMatrix(value: unknown): Matrix {
  const source = (Array.isArray(value) && value.length === 1 ? value[0] : value) as ArrayLike<number>;
  return [0, 1, 2, 3, 4, 5].map((index) => Number(source[index])) as Matrix;
}

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a * a2 + b * c2,
    a * b2 + b * d2,
    c * a2 + d * c2,
    c * b2 + d * d2,
    e * a2 + f * c2 + e2,
    e * b2 + f * d2 + f2,
  ];
}

function glyphGroups(operatorList: { fnArray: number[]; argsArray: unknown[] }): DrawnGlyph[][] {
  let current: Matrix = [...IDENTITY];
  const saved: Matrix[] = [];
  let text: Matrix = [...IDENTITY];
  let line: Matrix = [...IDENTITY];
  let leading = 0;
  let fontSize = 1;
  const groups: DrawnGlyph[][] = [];
  operatorList.fnArray.forEach((fn, index) => {
    const args = operatorList.argsArray[index] as number[] | undefined;
    if (fn === 10) {
      saved.push([...current]);
      return;
    }
    if (fn === 11) {
      current = saved.pop() ?? [...IDENTITY];
      return;
    }
    if (fn === 12) {
      current = multiply(asMatrix(args), current);
      return;
    }
    if (fn === 31) {
      text = [...IDENTITY];
      line = [...IDENTITY];
      return;
    }
    if (fn === 42) {
      text = asMatrix(args);
      line = [...text];
      return;
    }
    if (fn === 37 && args) {
      fontSize = args[1] || 1;
      return;
    }
    if (fn === 36 && args) {
      leading = args[0];
      return;
    }
    if ((fn === 40 || fn === 41) && args) {
      if (fn === 41) leading = -args[1];
      const next = multiply([1, 0, 0, 1, args[0], args[1]], line);
      text = next;
      line = next;
      return;
    }
    if (fn === 43) {
      const next = multiply([1, 0, 0, 1, 0, -leading], line);
      text = next;
      line = next;
      return;
    }
    if (fn !== SHOW_TEXT) return;
    const shown = (operatorList.argsArray[index] as [{ width: number; unicode?: string }[]] | undefined)?.[0] ?? [];
    const group: DrawnGlyph[] = [];
    shown.forEach((glyph) => {
      const user = multiply(text, current);
      const scaleX = Math.hypot(user[0], user[1]) || 1;
      const scaleY = Math.hypot(user[2], user[3]) || 1;
      const advance = ((glyph.width || 0) / 1000) * fontSize;
      group.push({
        x: user[4],
        y: user[5],
        w: Math.abs(scaleX * advance),
        size: Math.abs(fontSize * scaleY) || 11,
        unicode: glyph.unicode ?? "",
      });
      text = multiply([1, 0, 0, 1, advance, 0], text);
    });
    groups.push(group);
  });
  return groups;
}

function tokensFromGlyphs(glyphs: DrawnGlyph[], page: number): Token[] {
  const tokens: Token[] = [];
  let word: DrawnGlyph[] = [];
  const flush = () => {
    if (!word.length) return;
    const raw = word.map((glyph) => glyph.unicode).join("");
    const norm = normToken(raw);
    if (norm) {
      const x0 = Math.min(...word.map((glyph) => glyph.x));
      const x1 = Math.max(...word.map((glyph) => glyph.x + glyph.w));
      tokens.push({
        raw,
        norm,
        page,
        x0,
        x1,
        baseline: word[0].y,
        size: word[0].size,
      });
    }
    word = [];
  };
  glyphs.forEach((glyph, index) => {
    if (!glyph.unicode.trim()) {
      flush();
      return;
    }
    const previous = word[word.length - 1];
    if (previous) {
      const gap = glyph.x - (previous.x + previous.w);
      const split = Math.abs(glyph.y - previous.y) > 1.5 || gap > Math.max(1.8, previous.size * 0.22);
      if (split) flush();
    }
    word.push(glyph);
    if (index === glyphs.length - 1) flush();
  });
  return tokens;
}

function glyphCovered(glyph: DrawnGlyph, rects: Placement[]): boolean {
  return rects.some(
    (rect) =>
      rect.cover &&
      Math.abs(glyph.y - rect.baseline) <= 1 &&
      glyph.x >= rect.x - 0.6 &&
      glyph.x < rect.x + rect.width - 0.2,
  );
}

function pageStreams(pdf: PDFDocument, page: PDFPage): PDFRawStream[] {
  const leaf = (page as PDFPage & { node: PDFDict }).node;
  const contents = pdf.context.lookup(leaf.get(PDFName.of("Contents")));
  if (contents instanceof PDFArray) {
    const streams: PDFRawStream[] = [];
    for (let index = 0; index < contents.size(); index += 1) {
      streams.push(pdf.context.lookup(contents.get(index)) as PDFRawStream);
    }
    return streams;
  }
  return [contents as PDFRawStream];
}

function rewriteStream(raw: string, groups: DrawnGlyph[][], cursor: { index: number }, rects: Placement[]): string {
  const tokens = tokenizeContent(raw);
  const drop = new Array<boolean>(raw.length).fill(false);
  tokens.forEach((token, tokenIndex) => {
    if (token.kind !== "op" || (token.value !== "Tj" && token.value !== "TJ" && token.value !== "'" && token.value !== '"')) {
      return;
    }
    const group = groups[cursor.index];
    cursor.index += 1;
    if (!group?.length || !group.every((glyph) => glyphCovered(glyph, rects))) return;
    let start = token.start;
    if (token.value === "TJ") {
      for (let previous = tokenIndex - 1; previous >= 0; previous -= 1) {
        if (tokens[previous].value === "[") {
          start = tokens[previous].start;
          break;
        }
      }
    } else {
      for (let previous = tokenIndex - 1; previous >= 0; previous -= 1) {
        if (tokens[previous].kind === "str") {
          start = tokens[previous].start;
          break;
        }
      }
    }
    for (let offset = start; offset < token.end; offset += 1) drop[offset] = true;
  });
  let next = "";
  for (let index = 0; index < raw.length; index += 1) {
    if (!drop[index]) next += raw[index];
  }
  return next;
}

async function eraseCoveredText(pdf: PDFDocument, source: PDFDocumentProxy, placements: Placement[]): Promise<void> {
  for (let pageIndex = 0; pageIndex < pdf.getPageCount(); pageIndex += 1) {
    const rects = placements.filter((placement) => placement.page === pageIndex && placement.cover);
    if (!rects.length) continue;
    const sourcePage = await source.getPage(pageIndex + 1);
    const groups = glyphGroups(await sourcePage.getOperatorList());
    const page = pdf.getPage(pageIndex);
    const streams = pageStreams(pdf, page);
    const decoded = streams.map((stream) => latin1(decodePDFRawStream(stream).decode()));
    const shows = decoded.reduce(
      (total, raw) => total + tokenizeContent(raw).filter((token) => token.value === "Tj" || token.value === "TJ" || token.value === "'" || token.value === '"').length,
      0,
    );
    if (shows !== groups.length) continue;
    const cursor = { index: 0 };
    decoded.forEach((raw, streamIndex) => {
      const rewritten = rewriteStream(raw, groups, cursor, rects);
      const replacement = pdf.context.register(pdf.context.flateStream(fromLatin1(rewritten)));
      const leaf = (page as PDFPage & { node: PDFDict }).node;
      const contents = leaf.get(PDFName.of("Contents"));
      if (contents instanceof PDFArray) contents.set(streamIndex, replacement);
      else leaf.set(PDFName.of("Contents"), replacement);
    });
  }
}

export async function fillAffidavit(
  pdfBytes: Uint8Array,
  input: SearchMap,
  dummies: SearchMap,
): Promise<Uint8Array> {
  const values = valuesFrom(input);
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypt") || message.includes("password")) {
      throw new FillError("PDF зашифрован. Загрузите файл без пароля.");
    }
    throw new FillError("Не удалось открыть PDF. Файл повреждён или имеет неверный формат.");
  }
  if (pdf.getPageCount() === 0) {
    throw new FillError("PDF пуст: в файле нет страниц.");
  }
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFontBytes(), { subset: true });
  const source = await getDocument({ data: pdfBytes.slice(), verbosity: 0 }).promise;
  let tokens: Token[];
  let placements: Placement[];
  try {
    tokens = await readTokens(source);
    placements = collectPlacements(tokens, values, dummies);
    await eraseCoveredText(pdf, source, placements);
  } finally {
    await source.cleanup();
  }
  for (const placement of placements) {
    const page = pdf.getPage(placement.page);
    const written = placement.prefix && !placement.value.startsWith(placement.prefix)
      ? `${placement.prefix}${placement.value}`
      : placement.value;
    if (placement.cover) cover(page, placement, placement.size);
    if (placement.fitWidth > 1) {
      paint(page, written, placement.x, placement.baseline, placement.size, font, placement.fitWidth);
    } else {
      paintInside(page, written, placement.x, placement.baseline, placement.size, font, Math.max(placement.room, 4));
    }
  }
  return pdf.save();
}
