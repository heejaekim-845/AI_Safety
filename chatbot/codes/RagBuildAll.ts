/**
 * server/rag_build_all.ts — 멀티 매뉴얼 일괄 청킹·임베딩·머지
 *
 * 특징
 *  - 한/영 혼합 문서 자동 처리 (간단한 언어 감지)
 *  - 장·절/번호형(예: 제1장, 1.2.3), 로마숫자 장(Ⅰ-1), 순서도/원형숫자(①②…), 불릿(□/◦/▶/✓) 동시 지원
 *  - GIS/수력/조속기( Governor / HMI ) 용어 동의어 + 위험·수치 추출 강화
 *  - OpenAI 임베딩: 기본 text-embedding-3-small (다국어, 1536d), --model/--dims 옵션 제공
 *  - 문서별 출력 + 전체 NDJSON 병합 + (선택) MiniSearch 스파스 인덱스 병합
 *
 * 사용 예시
 *  ts-node server/rag_build_all.ts \
 *    --pdf "/mnt/data/2.1 170kV 50kA Spring GIS_취급설명서.pdf" \
 *    --pdf "/mnt/data/대청수력 수차발전기 대점검 순서도(배수).pdf" \
 *    --pdf "/mnt/data/2호기 조속기.pdf" \
 *    --pdf "/mnt/data/1호기 매뉴얼(en).pdf" \
 *    --pdf "/mnt/data/2호기 매뉴얼.pdf" \
 *    --out ./out_all --openai --merge --bm25
 *
 * 출력
 *  - 각 문서: out_all/<slug>/{chunks_*.json, embeddings.ndjson, minisearch_index.json}
 *  - 병합:    out_all/merged/embeddings.ndjson (+ minisearch_merged.json)
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore  
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

import MiniSearch from 'minisearch';
import { OpenAI } from 'openai';
// @ts-ignore
import { pipeline } from '@xenova/transformers';

// ----------------------------- CLI -----------------------------
const args = process.argv.slice(2);
function getFlag(name: string, def?: string) { const i = args.findIndex(a => a === `--${name}`); return i >= 0 ? args[i+1] : def; }
function hasFlag(name: string) { return args.includes(`--${name}`); }

const PDF_PATHS = args.flatMap((a, i) => a === '--pdf' ? [args[i+1]] : []);
const OUT_DIR = getFlag('out', './out_all')!;
const USE_OPENAI = hasFlag('openai');
const DO_MERGE = hasFlag('merge');
const DO_BM25 = hasFlag('bm25');
const EMB_MODEL = getFlag('model', 'text-embedding-3-small')!; // 기본 1536d 다국어
const EMB_DIMS = getFlag('dims') ? Number(getFlag('dims')!) : undefined; // 선택(예: 1024)
// ▼ overrides / manifest
const MANIFEST = getFlag('manifest');
const FAMILY_OVERRIDE = getFlag('family');
const EQUIP_OVERRIDE = getFlag('equipment'); // comma-separated

// ----------------------------- Types -----------------------------

type Collection = 'procedures' | 'checklists' | 'hazards' | 'specs' | 'leak_test' | 'schedule';

interface BaseMeta {
  doc_id: string;
  page_start: number;
  page_end: number;
  section_path?: string;
  title?: string;
  task_type?: string[];
  component?: string[];
  actuation?: string;
  hazards?: string[];
  standard_terms?: string[];
  spec?: Record<string, number | string>;
  alias_map?: Record<string, string[]>;
  source_anchor?: string;
  family?: string;
  equipment?: string[];
  work_area?: string;
  day?: number;
  step_no?: number;
  diving?: boolean;
  confined_space?: boolean;
  uses_crane?: boolean;
  scada_switch?: string;
  // ▼ added for versioning
  doc_version?: string;
  doc_date?: string; // YYYY-MM-DD
}

interface Chunk extends BaseMeta {
  id: string;
  chunk_id: string;
  text: string;
  char_len: number;
  collection: Collection;
}

interface EmbeddableDoc {
  id: string;
  text: string;
  metadata: BaseMeta & { collection: Collection };
  embedding?: number[];
}

// ----------------------------- Manifest & Overrides -----------------------------
interface ManifestEntry {
  match: string; // substring or regex (if starts and ends with /)
  family?: string;
  equipment?: string[];
  doc_id?: string;
  doc_version?: string;
  doc_date?: string; // YYYY-MM-DD
}
interface ManifestFile { docs: ManifestEntry[] }

function parseEquipCSV(s?: string): string[] | undefined { return s ? s.split(',').map(x=>x.trim()).filter(Boolean) : undefined; }

function loadManifest(file?: string): ManifestFile | undefined {
  if (!file) return undefined;
  try { const j = JSON.parse(fs.readFileSync(file,'utf-8')); if (Array.isArray(j)) return { docs: j }; return j as ManifestFile; } catch { return undefined; }
}

function patternMatch(file: string, pattern: string): boolean {
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    try { const re = new RegExp(pattern.slice(1,-1)); return re.test(file); } catch { return file.includes(pattern); }
  }
  return file.includes(pattern);
}

const MAN = loadManifest(MANIFEST);

function resolveMetaForFile(file: string, lang: 'ko'|'en') {
  // base guess
  let base = guessFamilyEquip(file, lang);
  let doc_id: string | undefined = undefined;
  let doc_version: string | undefined = undefined;
  let doc_date: string | undefined = undefined;

  // manifest override
  const entry = MAN?.docs?.find(d => patternMatch(file, d.match));
  if (entry) {
    if (entry.family) base.family = entry.family;
    if (entry.equipment) base.equipment = entry.equipment;
    if (entry.doc_id) doc_id = entry.doc_id;
    if (entry.doc_version) doc_version = entry.doc_version;
    if (entry.doc_date) doc_date = entry.doc_date;
  }

  // CLI override (highest priority)
  if (FAMILY_OVERRIDE) base.family = FAMILY_OVERRIDE;
  const eq = parseEquipCSV(EQUIP_OVERRIDE); if (eq && eq.length) base.equipment = eq;

  return { ...base, doc_id, doc_version, doc_date };
}

// ----------------------------- Utils -----------------------------
function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function slugify(s: string) { return s.replace(/[^\p{Letter}\p{Number}]+/gu, '_').replace(/^_+|_+$/g,'').slice(0,80) || 'doc'; }
function uuid(): string { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=(Math.random()*16)|0, v=c==='x'?r:(r&0x3)|0x8; return v.toString(16); }); }

// ----------------------------- Language & family guess -----------------------------
function detectLang(text: string) {
  const hangul = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const ascii = (text.match(/[A-Za-z]/g) || []).length;
  return hangul > ascii ? 'ko' : 'en';
}

function guessFamilyEquip(file: string, lang: 'ko'|'en') {
  const b = path.basename(file);
  const lower = b.toLowerCase();
  if (lower.includes('gis')) return { family: 'GIS', equipment: ['170kV GIS'] };
  if (lower.includes('조속기') || lower.includes('governor')) return { family: 'Hydro', equipment: ['Governor','HMI'] };
  if (lower.includes('순서도') || lower.includes('배수')) return { family: 'Hydro', equipment: ['수차발전기','방수문','배수'] };
  // 1호기/2호기 발전설비 운전유지보수 매뉴얼(발전기/여자/차단기 등)
  if (lower.includes('매뉴얼') || lower.includes('manual')) return { family: 'Hydro', equipment: ['Generator','Aux','Switchgear'] };
  return { family: 'Plant', equipment: ['Equipment'] };
}

// ----------------------------- Alias / Keywords -----------------------------
const ALIAS_MAP: Record<string, string[]> = {
  // GIS
  '차단기': ['CB','Circuit Breaker','브레이커'],
  '단로기': ['DS','Disconnect Switch'],
  '접지개폐기': ['ES','Earthing Switch','접지스위치'],
  '붓싱': ['Bushing'], '모선': ['Bus','Main Bus'], '가스': ['SF6','S F 6','육불화황'],
  // Hydro & site
  '배수펌프': ['Drainage Pump','배수 피트','DRAINAGE'], '방수문': ['Bulkhead Door','Flood Gate','벌크헤드'],
  '드레인 밸브': ['Drain Valve'], '취수문': ['Intake Gate'], '크레인': ['Gantry Crane','40TON','40 TON','40톤'],
  '밀폐공간': ['Confined Space'], '잠수': ['Diving'], 'SCADA': ['원격','DESK','현장','LOCAL','REMOTE'],
  // Governor / HMI
  '조속기': ['Governor','Digital Governor','Speed Governor','GOV'], 'HMI': ['Man-machine Interface','MMI','운전원 인터페이스','터치패널'],
  '컨트롤러': ['Controller','PLC','제어기'], 'Speed controller': ['SPC','속도 제어기'], 'Opening controller': ['OPC','개도 제어기'],
  'Power controller': ['POC','전력 제어기'], 'Wicket gate': ['Guide Vane','GV','위켓게이트','가이드베인','Gate opening'],
  'Servomotor': ['Hydraulic Servomotor','서보모터','유압 서보모터'], 'Droop': ['드룹','droop rate'], 'Isochronous': ['등시'],
  'Island operation': ['Isolated network','Island mode','독립계통','단독계통'], 'Paralleling': ['병렬운전','동기 투입','Synchronizing'],
  'Overspeed test': ['오버스피드 시험','과속 시험'], 'Alarm': ['알람','경보'], 'Warning': ['주의','경고'], 'Trip': ['정지','트립'],
  'Frequency': ['Hz','주파수'], 'RPM': ['r/min','회전속도'], 'Setpoint': ['SP','설정치'], 'Gain': ['Kp','Ki','Kd','PID','이득'],
};

const TASK_KEYWORDS = {
  procedures: [/절차|순서|조작|설정|튜닝|파라미터|세트포인트|동기|병입|전환|AUTO|MANUAL|Start|Stop/i,
               /배수|방수문|취수문|드레인|펌프\s*START|OPEN|CLOSE|overspeed|island|paralleling/i],
  checklists: [/체크리스트|점검표|작업 전 체크|확인사항|사전 점검|pre-?test checklist|FAT|SAT/i],
  hazards: [/주의|경고|금지|위험|엄금|추락|잠수|밀폐공간|가스|질식|overspeed|유압|회전체|LOTO|lockout|tagout/i],
  specs: [/정격|사양|허용치|한계|ppm\b|MPaG|kV\b|A\b|Hz\b|kgf\/?cm2|TON|분\b|O2|CO2|H2S|CO|RPM\b|%\b|MW\b|Kp|Ki|Kd/i],
  leak_test: [/누설|리크|비누거품|Leak Detector|리크디텍터/i],
  schedule: [/(\d+)일차|일정|스케줄/i],
};

const STANDARD_TERMS = [
  'GIS','SF6','CB','DS','ES','Bushing','Bus',
  '배수','방수문','드레인','펌프','크레인','밀폐공간','잠수','SCADA',
  'Governor','SPC','OPC','POC','Wicket gate','Guide Vane','Servomotor',
  'Droop','Isochronous','Island operation','Paralleling','Overspeed test',
  'PID','Kp','Ki','Kd','Setpoint','Frequency','RPM','Gate opening','MW'
];

// 텍스트에서 실제 포함된 표준 용어만 추출
function extractRelevantTerms(text: string, allTerms: string[]): string[] {
  return allTerms.filter(term => {
    const lowerTerm = term.toLowerCase();
    // 정확한 단어 매칭만 사용 (부분 문자열 매칭 제거)
    const regex = new RegExp(`\\b${lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  });
}

// ----------------------------- PDF → page texts -----------------------------
async function extractPages(pdfPath: string): Promise<string[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(' ').replace(/\s+/g,' ').replace(/\u0000/g,'').trim();
    pages.push(text);
  }
  return pages;
}

// ----------------------------- Heading detection -----------------------------
const reChapterKo = /제\s*(\d+)\s*장/;
const reSectionNum = /(^|\s)(\d+\.\d+(?:\.\d+)?)/; // 1.2 or 1.2.3
const reRoman = /[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]-\d+/;             // Ⅰ-1 형태 (2호기 한글 매뉴얼) 
const reCaption = /(그림|표)\s*\d+|▣\s*(그림|표)/;
const reDay = /(\b[12])일차/; // 순서도
const reCircled = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/;
const reBullet = /[□◦▶✓]/;

function splitByHeadings(pages: string[]): { page: number, line: string }[] {
  const lines: { page: number, line: string }[] = [];
  pages.forEach((p, idx) => {
    const tentative = p.split(
      /(?<=\.)\s+|(?=제\s*\d+\s*장)|(?=\b\d+\.\d+(?:\.\d+)?)|(?=\b[12]일차)|(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])|(?=[□◦▶✓])|(?=[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]-\d+)/g
    );
    tentative.forEach(seg => { const line = seg.trim(); if (line) lines.push({ page: idx+1, line }); });
  });
  return lines;
}

function circledToInt(s: string): number | undefined {
  const map: Record<string, number> = { '①':1,'②':2,'③':3,'④':4,'⑤':5,'⑥':6,'⑦':7,'⑧':8,'⑨':9,'⑩':10,'⑪':11,'⑫':12,'⑬':13,'⑭':14,'⑮':15,'⑯':16,'⑰':17,'⑱':18,'⑲':19,'⑳':20 };
  const m = s.match(reCircled); return m ? map[m[0]] : undefined;
}

function buildSectionPathTracker() {
  let chapter = '', section = '';
  let day = 0, step = 0;
  let roman = '';
  return function next(line: string): string | undefined {
    const ch = line.match(reChapterKo); if (ch) { chapter = `제${ch[1]}장`; section=''; roman=''; day=0; step=0; return chapter; }
    const sec = line.match(reSectionNum); if (sec) { section = sec[2]; return [chapter, section].filter(Boolean).join('>'); }
    const ro = line.match(reRoman); if (ro) { roman = ro[0]; return roman; }
    const d = line.match(reDay); if (d) { day = Number(d[1]); step=0; return `${day}일차`; }
    if (reCircled.test(line)) { step = circledToInt(line) || 0; return [day ? `${day}일차` : '', step ? `⑴${step}` : ''].filter(Boolean).join('>'); }
    return undefined;
  };
}

// ----------------------------- Chunking & classify -----------------------------
const TARGET_CHARS = 950;   // 일반 서술 위주 문서 최적화
const OVERLAP_CHARS = 80;

function classifyCollection(text: string): Collection {
  if (TASK_KEYWORDS.hazards.some(r => r.test(text))) return 'hazards';
  if (TASK_KEYWORDS.checklists.some(r => r.test(text))) return 'checklists';
  if (TASK_KEYWORDS.leak_test.some(r => r.test(text))) return 'leak_test';
  if (TASK_KEYWORDS.specs.some(r => r.test(text))) return 'specs';
  if (TASK_KEYWORDS.schedule.some(r => r.test(text))) return 'schedule';
  return 'procedures';
}

function guessTaskTypes(text: string): string[] {
  const m: string[] = [];
  if (/설치|운송|해체|installation|assembly/i.test(text)) m.push('설치');
  if (/운전|투입|정지|AUTO|MANUAL|paralleling|island|operation/i.test(text)) m.push('운전');
  if (/점검|확인|체크|체크리스트|FAT|SAT|inspection|test/i.test(text)) m.push('점검');
  if (/주입|보충|진공|가스|배수|드레인|방수문|펌프|overspeed/i.test(text)) m.push('가스/배수/시험');
  return Array.from(new Set(m));
}

function guessComponents(text: string): string[] {
  const list: string[] = [];
  for (const [k, aliases] of Object.entries(ALIAS_MAP)) {
    if (text.includes(k) || aliases.some(a => text.includes(a))) list.push(k);
  }
  return Array.from(new Set(list));
}

function extractSpecs(text: string): Record<string, number | string> {
  const spec: Record<string, number | string> = {};
  const kgf = text.match(/(\d+(?:\.\d+)?)\s*kgf\/?cm2/i); if (kgf) spec.pressure_kgfcm2 = Number(kgf[1]);
  const ton = text.match(/(\d+)\s*TON/i); if (ton) spec.crane_ton = Number(ton[1]);
  const minutes = text.match(/(\d+)\s*분\b/); if (minutes) spec.minutes = Number(minutes[1]);
  const o2 = text.match(/O2\)?\s*(\d+(?:\.\d+)?)%/i); if (o2) spec.o2_pct = Number(o2[1]);
  const co2 = text.match(/CO2\)?\s*(\d+(?:\.\d+)?)%/i); if (co2) spec.co2_pct = Number(co2[1]);
  const h2s = text.match(/H2S\)?\s*(\d+)\s*ppm/i); if (h2s) spec.h2s_ppm = Number(h2s[1]);
  const co = text.match(/(?<!CO2)CO\)?\s*(\d+)\s*ppm/i); if (co) spec.co_ppm = Number(co[1]);
  const hz = text.match(/(\d+(?:\.\d+)?)\s*Hz\b/i); if (hz) spec.frequency_Hz = Number(hz[1]);
  const rpm = text.match(/(\d+(?:\.\d+)?)\s*(RPM|r\/min)\b/i); if (rpm) spec.speed_rpm = Number(rpm[1]);
  const mw = text.match(/(\d+(?:\.\d+)?)\s*MW\b/i); if (mw) spec.power_MW = Number(mw[1]);
  const gate = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:GV|gate|opening|개도)?/i); if (gate) spec.gate_open_pct = Number(gate[1]);
  const droop = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:droop|드룹)/i); if (droop) spec.droop_pct = Number(droop[1]);
  const pidRe = /(Kp|Ki|Kd)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/gi; let m: RegExpExecArray | null; while ((m = pidRe.exec(text))) { const key = m[1].toLowerCase(); spec[`pid_${key}`] = Number(m[2]); }
  return spec;
}

function extractFlags(text: string) {
  return {
    diving: /(잠수|Diving)/i.test(text),
    confined_space: /(밀폐공간|Confined)/i.test(text),
    uses_crane: /(크레인|Gantry)/i.test(text),
    scada_switch: (/SCADA/.test(text) && /(DESK|현장|LOCAL|REMOTE)/.test(text)) ? (text.match(/SCADA\s*→?\s*(DESK|현장|LOCAL|REMOTE)/)?.[0] || 'SCADA switchover') : undefined,
  } as Pick<BaseMeta,'diving'|'confined_space'|'uses_crane'|'scada_switch'>;
}

function makeTitle(seed: string): string { const s = seed.replace(/\s+/g,' ').slice(0,80); return s.includes('.') ? s.split('.')[0] : s; }

function buildChunk(docId: string, family: string, equipment: string[], text: string, pageStart: number, pageEnd: number, sectionPath?: string, sourceAnchor?: string, docVersion?: string, docDate?: string): Chunk {
  const collection = classifyCollection(text);
  const dayMatch = sectionPath?.match(/(\d)일차/);
  const stepMatch = sectionPath?.match(/⑴(\d+)/);
  const flags = extractFlags(text);
  const meta: BaseMeta = {
    doc_id: docId,
    page_start: pageStart,
    page_end: pageEnd,
    section_path: sectionPath,
    title: makeTitle(text),
    task_type: guessTaskTypes(text),
    component: guessComponents(text),
    actuation: '스프링',
    hazards: collection === 'hazards' ? ['추락','질식','가스','감전','잠수','밀폐공간','overspeed'].filter(h => new RegExp(h,'i').test(text)) : undefined,
    standard_terms: extractRelevantTerms(text, STANDARD_TERMS),
    spec: Object.keys(extractSpecs(text)).length ? extractSpecs(text) : undefined,
    alias_map: ALIAS_MAP,
    source_anchor: sourceAnchor,
    doc_version: docVersion,
    doc_date: docDate,
    family,
    equipment,
    work_area: /지하\s*\d층|발전소|본댐|수문|피트|갱도|control room|governor/i.test(text) ? (text.match(/(지하\s*\d층|본댐|발전소|방수문|배수\s*피트|갱도|control room|governor)/i)?.[0]) : undefined,
    day: dayMatch ? Number(dayMatch[1]) : undefined,
    step_no: stepMatch ? Number(stepMatch[1]) : undefined,
    ...flags,
  };
  return { id: uuid(), chunk_id: `${docId}-${pageStart}-${pageEnd}-${Math.random().toString(36).slice(2,7)}`, text, char_len: text.length, collection, ...meta } as Chunk;
}

function chunkify(pages: string[], docId: string, family: string, equipment: string[], docVersion?: string, docDate?: string): Chunk[] {
  const tracker = buildSectionPathTracker();
  const chunks: Chunk[] = [];
  let buf = ''; let bufStartPage = 1; let currentSectionPath = ''; let sourceAnchor = '';
  for (const [idx, p] of pages.entries()) {
    const page = idx + 1;
    // 라인 분할 & 섹션 추적
    const lines = splitByHeadings([p]);
    for (const item of lines) {
      const sp = tracker(item.line);
      if (sp) {
        if (buf.trim().length > 180) {
          const text = buf.trim();
          chunks.push(buildChunk(docId, family, equipment, text, bufStartPage, page, currentSectionPath, sourceAnchor, docVersion, docDate));
          buf = text.slice(Math.max(0, text.length - OVERLAP_CHARS));
          bufStartPage = page; sourceAnchor = '';
        }
        currentSectionPath = sp;
      }
      if (reCaption.test(item.line)) sourceAnchor = `p.${page} ${item.line.match(reCaption)?.[0]}`;
      if ((buf + ' ' + item.line).length >= TARGET_CHARS) {
        const text = (buf + ' ' + item.line).trim();
        chunks.push(buildChunk(docId, family, equipment, text, bufStartPage, page, currentSectionPath, sourceAnchor, docVersion, docDate));
        buf = text.slice(Math.max(0, text.length - OVERLAP_CHARS));
        bufStartPage = page; sourceAnchor = '';
      } else {
        buf += (buf ? ' ' : '') + item.line;
      }
    }
  }
  if (buf.trim()) { const lastPage = pages.length; chunks.push(buildChunk(docId, family, equipment, buf.trim(), bufStartPage, lastPage, currentSectionPath, sourceAnchor, docVersion, docDate)); }
  return chunks;
}

// ----------------------------- Embeddings -----------------------------
async function embedDocs(docs: EmbeddableDoc[]): Promise<EmbeddableDoc[]> {
  if (USE_OPENAI) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const out: EmbeddableDoc[] = []; const BATCH = 64;
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const res = await client.embeddings.create({ model: EMB_MODEL, input: batch.map(d => d.text), ...(EMB_DIMS ? { dimensions: EMB_DIMS } : {}) });
      res.data.forEach((d, j) => { const src = batch[j]; out.push({ ...src, embedding: d.embedding as unknown as number[] }); });
      process.stdout.write(`\rEmbed ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
    }
    process.stdout.write('\n'); return out;
  } else {
    // 기본 로컬 영어 임베더 — 다국어를 원하면 'Xenova/bge-m3' 등으로 교체
    const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    const out: EmbeddableDoc[] = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]; const res = (await embedder(d.text)) as any; const lastHidden = res.data as number[][]; const dim = lastHidden[0].length; const avg = new Array(dim).fill(0);
      for (const row of lastHidden) for (let k = 0; k < dim; k++) avg[k] += row[k]; for (let k = 0; k < dim; k++) avg[k] /= lastHidden.length;
      out.push({ ...d, embedding: avg }); if (i % 10 === 0) process.stdout.write(`\rLocal embed ${i+1}/${docs.length}`);
    }
    process.stdout.write('\n'); return out;
  }
}

// ----------------------------- MiniSearch -----------------------------
function buildMiniSearch(rows: EmbeddableDoc[]) {
  const mini = new MiniSearch({
    fields: ['title','section_path','alias_tokens','work_area'],
    storeFields: ['id','title','section_path','collection','family','equipment','day','step_no'],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 3, section_path: 2, alias_tokens: 4, work_area: 1.5 } },
  });
  const msDocs = rows.map(d => ({
    id: d.id,
    title: d.metadata.title || '',
    section_path: d.metadata.section_path || '',
    collection: (d.metadata as any).collection as string,
    family: (d.metadata as any).family || '',
    equipment: Array.isArray((d.metadata as any).equipment) ? (d.metadata as any).equipment.join(',') : '',
    day: (d.metadata as any).day || '',
    step_no: (d.metadata as any).step_no || '',
    alias_tokens: Object.entries(d.metadata.alias_map || {}).flatMap(([k, arr]) => [k, ...(arr || [])]).join(' '),
    work_area: (d.metadata as any).work_area || '',
  }));
  mini.addAll(msDocs);
  return mini;
}

// ----------------------------- Persist helpers -----------------------------
function writeJSON(file: string, data: any) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data,null,2), 'utf-8'); }
function writeNDJSON(file: string, rows: any[]) { ensureDir(path.dirname(file)); fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n'), 'utf-8'); }

// ----------------------------- Main -----------------------------
async function processOne(file: string) {
  const base = path.basename(file);
  console.log(`
[DOC] ${base}`);
  const pages = await extractPages(file);
  const lang = detectLang(pages.slice(0,5).join(' '));
  const meta0 = resolveMetaForFile(file, lang as any);
  const docId = meta0.doc_id || base;
  const chunks = chunkify(pages, docId, meta0.family, meta0.equipment, meta0.doc_version, meta0.doc_date);
  const outDir = path.join(OUT_DIR, slugify(base));
  writeJSON(path.join(outDir, 'chunks_all.json'), chunks);
  const byCol: Record<Collection, Chunk[]> = { procedures: [], checklists: [], hazards: [], specs: [], leak_test: [], schedule: [] } as any;
  for (const c of chunks) byCol[c.collection].push(c);
  (Object.keys(byCol) as Collection[]).forEach(k => writeJSON(path.join(outDir, `chunks_${k}.json`), byCol[k]));

  const docs: EmbeddableDoc[] = chunks.map(c => ({ id: c.id, text: c.text, metadata: { ...c, collection: c.collection } }));
  const embedded = await embedDocs(docs);
  writeNDJSON(path.join(outDir, 'embeddings.ndjson'), embedded.map(e => ({ id: e.id, text: e.text, embedding: e.embedding, metadata: e.metadata })));

  if (DO_BM25) { const mini = buildMiniSearch(embedded); writeJSON(path.join(outDir, 'minisearch_index.json'), mini.toJSON()); }

  console.log(`  lang=${lang}, family=${meta0.family}, equipment=${meta0.equipment.join('/')}, pages=${pages.length}, chunks=${chunks.length}, out=${outDir}`);
  return path.join(outDir, 'embeddings.ndjson');
}

async function main() {
  if (!PDF_PATHS.length) { console.error('사용법: --pdf <file> (여러 번) --out ./out_all --openai [--merge] [--bm25] [--model text-embedding-3-small] [--dims 1024]'); process.exit(1); }
  ensureDir(OUT_DIR);
  const ndjsonPaths: string[] = [];
  for (const f of PDF_PATHS) {
    try { ndjsonPaths.push(await processOne(f)); } catch (e) { console.error('\nERROR processing', f, e); }
  }
  if (DO_MERGE && ndjsonPaths.length) {
    const mergedDir = path.join(OUT_DIR, 'merged'); ensureDir(mergedDir);
    const outFile = path.join(mergedDir, 'embeddings.ndjson');
    const all = ndjsonPaths.flatMap(p => fs.readFileSync(p,'utf-8').trim().split('\n').filter(Boolean));
    fs.writeFileSync(outFile, all.join('\n') + '\n', 'utf-8');
    console.log(`[MERGED] ${outFile} (rows=${all.length})`);

    if (DO_BM25) {
      // 가벼운 병합 BM25: 각 ndjson 읽어 메타/텍스트만 사용
      const rows = all.map(j => JSON.parse(j));
      const mini = buildMiniSearch(rows);
      writeJSON(path.join(mergedDir, 'minisearch_merged.json'), mini.toJSON());
      console.log('[BM25] merged minisearch_merged.json');
    }
  }
  console.log('\n완료. 이제 Vectra 인덱스로 인제스트 하세요:');
  console.log('  ts-node server/index_vectra.ts --file ./out_all/merged/embeddings.ndjson --store ./vectra-rag --index plant-rag');
}

main().catch(e => { console.error(e); process.exit(1); });
