/**
 * server/index_vectra.ts — Vectra 인제스트(적재) 스크립트
 *
 * 변경 사항 반영:
 *  - NDJSON(embeddings.ndjson) 내 metadata.family / equipment / doc_id / doc_version / doc_date 그대로 보존
 *  - 인제스트 대상 필터: --family/--equipment/--doc-id/--collection/--since-date
 *  - 동일 doc_id가 다수 버전일 때 최신 날짜만 인제스트: --latest-per-doc (doc_date 기준)
 *  - 차원 자동 감지 → 인덱스 생성(없으면) / 차원 불일치 검증
 *  - 체크포인트 재시작(.cache/vectra/<index>.ckpt.json) 및 중복 id 스킵
 *  - (선택) 검증 질의: --verify "query text" (OpenAI 임베딩 사용)
 *
 * 사용 예시
 *  ts-node server/index_vectra.ts \
 *    --file ./out_all/merged/embeddings.ndjson \
 *    --store ./vectra-chatbot --index plant-rag \
 *    --family Hydro --equipment "Governor,HMI" \
 *    --latest-per-doc --since-date 2023-01-01
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { OpenAI } from 'openai';

// NOTE: 프로젝트에 맞는 Vectra SDK를 설치하세요.
// 예: npm i vectra (또는 사내 패키지)
// 아래 타입은 사용 예시이며, 실제 SDK에 맞게 조정 필요합니다.
interface VectraItem { id: string; vector: number[]; metadata?: any; text?: string }
class Vectra {
  constructor(public opts: { path: string }) {}
  async createIndex(name: string, dim: number, metric: 'cosine'|'ip'|'l2' = 'cosine') { /* ... */ }
  index(name: string) { return {
    addItems: async (items: VectraItem[]) => { /* ... */ },
    queryItems: async (vector: number[], k = 5) => { return [] as any[]; },
    info: async () => ({ dim: null as number | null }),
  }; }
}

// ----------------------------- CLI -----------------------------
const args = process.argv.slice(2);
function getFlag(name: string, def?: string) { const i = args.findIndex(a => a === `--${name}`); return i >= 0 ? args[i+1] : def; }
function hasFlag(name: string) { return args.includes(`--${name}`); }

const FILES = args.flatMap((a, i) => a === '--file' ? [args[i+1]] : []);
const STORE = getFlag('store', './vectra-chatbot')!;
const INDEX = getFlag('index', 'plant-rag')!;
const METRIC = (getFlag('metric', 'cosine') as 'cosine'|'ip'|'l2');
const BATCH = Number(getFlag('batch', '256'));
const CKPT = getFlag('ckpt', path.join('.cache','vectra', `${INDEX}.ckpt.json`))!;
const SKIP_IF_EXISTS = hasFlag('skip-if-exists');
const LATEST_PER_DOC = hasFlag('latest-per-doc');
const SINCE_DATE = getFlag('since-date'); // YYYY-MM-DD
const FILTER_FAMILY = getFlag('family');
const FILTER_EQUIP = getFlag('equipment'); // comma
const FILTER_DOCID = getFlag('doc-id'); // comma
const FILTER_COLLECTION = getFlag('collection'); // comma
const VERIFY_TEXT = getFlag('verify');
const EMB_MODEL = getFlag('model', 'text-embedding-3-small')!;
const EMB_DIMS = getFlag('dims') ? Number(getFlag('dims')!) : undefined;

// ----------------------------- Helpers -----------------------------
function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function parseCSV(s?: string) { return s ? s.split(',').map(x=>x.trim()).filter(Boolean) : undefined; }
function toDate(s?: string) { if (!s) return undefined; const t = Date.parse(s); return isNaN(t) ? undefined : new Date(t); }
function loadCkpt(file: string) { try { return JSON.parse(fs.readFileSync(file,'utf-8')); } catch { return { done:false, line:0, ids:{} as Record<string,1> }; } }
function saveCkpt(file: string, data: any) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data,null,2),'utf-8'); }

// 입력 라인 타입
interface NdjsonRow { id: string; text?: string; embedding: number[]; metadata: any }

function rowPassesFilters(r: NdjsonRow): boolean {
  const m = r.metadata || {};
  if (FILTER_FAMILY && m.family !== FILTER_FAMILY) return false;
  const eq = parseCSV(FILTER_EQUIP); if (eq && (!Array.isArray(m.equipment) || !eq.some((e:string)=> m.equipment.includes(e)))) return false;
  const dids = parseCSV(FILTER_DOCID); if (dids && !dids.includes(m.doc_id)) return false;
  const cols = parseCSV(FILTER_COLLECTION); if (cols && !cols.includes(m.collection)) return false;
  if (SINCE_DATE) {
    const d = toDate(m.doc_date); const since = toDate(SINCE_DATE);
    if (since && (!d || d < since)) return false;
  }
  return true;
}

async function ensureIndex(v: Vectra, name: string, dim: number) {
  const ix = v.index(name); const info = await ix.info().catch(()=>({ dim: null as number | null }));
  if (!info.dim) {
    console.log(`[INIT] create index '${name}' dim=${dim} metric=${METRIC}`);
    await v.createIndex(name, dim, METRIC);
  } else if (info.dim !== dim) {
    throw new Error(`인덱스 차원 불일치: index(${info.dim}) vs embeddings(${dim}). 새 인덱스를 쓰거나 재구축하세요.`);
  }
}

async function ingest() {
  if (!FILES.length) { console.error('사용법: --file <embeddings.ndjson> (여러 개 가능) --store ./vectra-chatbot --index plant-rag [옵션]'); process.exit(1); }
  const vectra = new Vectra({ path: STORE });
  ensureDir(path.dirname(CKPT)); const ck = loadCkpt(CKPT);

  // 첫 파일 첫 줄에서 차원 확인
  let dim = 0; {
    const f = FILES[0]; const firstLine = fs.readFileSync(f,'utf-8').split('\n').find(Boolean);
    if (!firstLine) throw new Error('빈 파일: ' + f);
    const j = JSON.parse(firstLine) as NdjsonRow; dim = j.embedding.length;
  }
  await ensureIndex(vectra, INDEX, dim);

  const seenIds: Record<string,1> = ck.ids || {};
  const latestByDoc: Record<string, string> = {}; // doc_id -> doc_date (ISO)

  if (LATEST_PER_DOC) console.log('[MODE] latest-per-doc 활성화 (doc_date 최신만 적재)');
  if (FILTER_FAMILY || FILTER_EQUIP || FILTER_DOCID || FILTER_COLLECTION || SINCE_DATE) {
    console.log('[FILTER]', { family: FILTER_FAMILY, equipment: FILTER_EQUIP, doc_id: FILTER_DOCID, collection: FILTER_COLLECTION, since: SINCE_DATE });
  }

  let total = 0, passed = 0, added = 0, skipped = 0;
  const batch: VectraItem[] = [];

  for (const file of FILES) {
    console.log(`[READ] ${file}`);
    const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf-8' }) });
    let lineNo = 0;
    for await (const line of rl) {
      if (!line.trim()) continue; lineNo++;
      total++;
      if (ck.line && total <= ck.line) continue; // 이어서 재시작

      const row = JSON.parse(line) as NdjsonRow;
      if (!row.embedding || !Array.isArray(row.embedding)) continue;

      if (!rowPassesFilters(row)) { skipped++; continue; }

      // 최신 버전만
      if (LATEST_PER_DOC && row.metadata?.doc_id) {
        const did = row.metadata.doc_id as string; const d = row.metadata.doc_date as string | undefined;
        const prev = latestByDoc[did];
        if (!prev || (d && prev && d > prev)) { latestByDoc[did] = d || prev || ''; }
        // latest 지도 구축 후, 실제 적재는 아래에서 평가
      }

      // 중복 id 스킵
      if (SKIP_IF_EXISTS && seenIds[row.id]) { skipped++; continue; }

      batch.push({ id: row.id, vector: row.embedding, metadata: row.metadata, text: row.text });
      passed++;

      if (batch.length >= BATCH) {
        const finalBatch = LATEST_PER_DOC ? batch.filter(it => {
          const did = it.metadata?.doc_id; if (!did) return true; const dd = it.metadata?.doc_date; const latest = latestByDoc[did];
          return !latest || !dd || dd === latest; // doc_date가 최신인 것만
        }) : batch;
        if (finalBatch.length) {
          await vectra.index(INDEX).addItems(finalBatch);
          added += finalBatch.length; finalBatch.forEach(it => { seenIds[it.id] = 1; });
        }
        ck.line = total; ck.ids = seenIds; saveCkpt(CKPT, ck);
        batch.length = 0;
        process.stdout.write(`\rINGEST added=${added} skipped=${skipped} (read=${total})`);
      }
    }
  }

  // 남은 배치 처리
  if (batch.length) {
    const finalBatch = LATEST_PER_DOC ? batch.filter(it => {
      const did = it.metadata?.doc_id; if (!did) return true; const dd = it.metadata?.doc_date; const latest = latestByDoc[did];
      return !latest || !dd || dd === latest;
    }) : batch;
    if (finalBatch.length) {
      await vectra.index(INDEX).addItems(finalBatch);
      added += finalBatch.length; finalBatch.forEach(it => { seenIds[it.id] = 1; });
    }
    ck.line = total; ck.ids = seenIds; saveCkpt(CKPT, ck);
  }

  console.log(`\nDONE added=${added} / passed=${passed} / read=${total} / skipped=${skipped}`);

  // 검증 질의
  if (VERIFY_TEXT) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await client.embeddings.create({ model: EMB_MODEL, input: VERIFY_TEXT, ...(EMB_DIMS ? { dimensions: EMB_DIMS } : {}) });
    const q = emb.data[0].embedding as unknown as number[];
    const hits = await vectra.index(INDEX).queryItems(q, 5);
    console.log('\n[VERIFY] top-5 =', hits);
  }
}

ingest().catch(e => { console.error('\nERROR', e); process.exit(1); });
