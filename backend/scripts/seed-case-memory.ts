/**
 * Seed CaseMemory from CSV of real Anatel complaints + responses.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-case-memory.ts /path/to/anatel_filtrado.csv
 *
 * Requires OPENAI_API_KEY in environment for embedding generation.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import OpenAI from 'openai';

config({ path: path.resolve(__dirname, '../.env') });

// ── CSV row shape ──────────────────────────────────────────────
interface CsvRow {
  'Serviço': string;
  'Primeiro Serviço': string;
  'Modalidade': string;
  'Motivo': string;
  'Perfil Responsável': string;
  'Descrição Reclamação': string;
  'Resposta Anatel': string;
  'Justificativa': string;
  'Situação': string;
}

// ── Tipology key mapping ───────────────────────────────────────
function mapModalidadeToTipologyKey(modalidade: string): string {
  const m = modalidade.toLowerCase();
  if (m.includes('cobrança') || m.includes('cobranca')) return 'cobranca';
  if (m.includes('plano') || m.includes('oferta') || m.includes('promoç')) return 'plano_servicos';
  if (m.includes('cancelamento')) return 'cancelamento';
  if (m.includes('portabilidade')) return 'portabilidade';
  if (m.includes('qualidade') || m.includes('reparo')) return 'qualidade';
  if (m.includes('atendimento')) return 'atendimento';
  return 'cobranca'; // fallback
}

// ── Extract protocol from complaint text ───────────────────────
function extractProtocol(text: string): string | null {
  const match = text.match(/protocolo[^\d]*(\d{13,})/i)
    ?? text.match(/nº[:\s]*(\d{13,})/i)
    ?? text.match(/ID[:\s]*(\d{13,})/i);
  return match ? match[1] : null;
}

// ── Summarise complaint for CaseMemory.summary ────────────────
function buildSummary(row: CsvRow): string {
  return `[${row['Modalidade']}] ${row['Motivo']}: ${row['Descrição Reclamação'].substring(0, 300)}`;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: ts-node scripts/seed-case-memory.ts <csv-path>');
    process.exit(1);
  }

  // Read & parse CSV (UTF-8 with BOM)
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV`);

  // Connect to DB
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USER ?? process.env.DB_USERNAME ?? 'bko',
    password: process.env.DB_PASS ?? process.env.DB_PASSWORD ?? 'bko',
    database: process.env.DB_NAME ?? process.env.DB_DATABASE ?? 'bkoagent',
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  console.log('DB connected');

  // OpenAI client for embeddings
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Load tipology map: key -> id
  const tipRows = await ds.query('SELECT id, key FROM tipology');
  const tipMap = new Map<string, string>(tipRows.map((r: any) => [r.key, r.id]));

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const complaintText = row['Descrição Reclamação'] ?? '';
    const responseText = row['Resposta Anatel'] ?? '';
    if (!complaintText) { skipped++; continue; }

    const protocolFromText = extractProtocol(complaintText);
    const protocolNumber = protocolFromText ?? `TRAINING-${String(i + 1).padStart(4, '0')}`;

    // Check if already exists
    const existing = await ds.query(
      'SELECT id FROM complaint WHERE "protocolNumber" = $1',
      [protocolNumber],
    );
    if (existing.length > 0) {
      console.log(`  [${i + 1}] skip (exists): ${protocolNumber}`);
      skipped++;
      continue;
    }

    const tipKey = mapModalidadeToTipologyKey(row['Modalidade']);
    const tipologyId = tipMap.get(tipKey) ?? null;
    const isProcedente = row['Situação']?.toLowerCase().includes('procedente')
      && !row['Situação']?.toLowerCase().includes('improcedente');

    // 1. Create complaint record
    const [inserted] = await ds.query(
      `INSERT INTO complaint (
        "protocolNumber", "rawText", "normalizedText", status, "riskLevel",
        source, "isOverdue", "tipologyId", procedente,
        modalidade, motivo, "servicoPrincipal", "perfilResponsavel"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id`,
      [
        protocolNumber,
        complaintText,
        complaintText, // normalizedText = rawText for training data
        'completed',
        'low',
        'training_csv',
        false,
        tipologyId,
        isProcedente,
        row['Modalidade'],
        row['Motivo'],
        row['Serviço'],
        row['Perfil Responsável'],
      ],
    );
    const complaintId = inserted.id;

    // 2. Generate embedding for the complaint text
    const embText = `${row['Modalidade']} | ${row['Motivo']} | ${complaintText.substring(0, 1500)}`;
    const embResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embText,
    });
    const embedding = embResponse.data[0].embedding;
    const embVector = `[${embedding.join(',')}]`;

    // 3. Create CaseMemory record
    await ds.query(
      `INSERT INTO case_memory (
        summary, decision, outcome, "responseSnippet",
        embedding, "isActive", "complaintId", "tipologyId"
      ) VALUES ($1,$2,$3,$4,$5::vector,$6,$7,$8)`,
      [
        buildSummary(row),
        row['Justificativa'] || null,
        isProcedente ? 'procedente' : 'improcedente',
        responseText.substring(0, 2000),
        embVector,
        true,
        complaintId,
        tipologyId,
      ],
    );

    created++;
    console.log(`  [${i + 1}/${rows.length}] ✓ ${protocolNumber} (${tipKey}, ${isProcedente ? 'proc' : 'improc'})`);
  }

  await ds.destroy();
  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
