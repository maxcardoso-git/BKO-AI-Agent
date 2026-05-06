/**
 * Seed KB with regulatory response templates from Anatel CSVs.
 *
 * Each CSV becomes a kb_document with one chunk per regulatory item.
 * Chunks are embedded for similarity search during retrieve_context step.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-kb-regulatory.ts /path/to/csv-folder/
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import OpenAI from 'openai';

config({ path: path.resolve(__dirname, '../.env') });

// ── CSV file → modalidade/tipology mapping ─────────────────────
const FILE_MAP: Record<string, { modalidade: string; tipologyKey: string }> = {
  'Atendimento.csv':      { modalidade: 'Atendimento', tipologyKey: 'atendimento' },
  'Bloqueio.csv':          { modalidade: 'Bloqueio, Desbloqueio ou Suspensão', tipologyKey: 'cobranca' },
  'Cancelamento.csv':      { modalidade: 'Cancelamento', tipologyKey: 'cancelamento' },
  'Cobrança.csv':          { modalidade: 'Cobrança', tipologyKey: 'cobranca' },
  'Crédito.csv':           { modalidade: 'Crédito Pré-Pago', tipologyKey: 'cobranca' },
  'Dados.csv':             { modalidade: 'Dados Cadastrais ou Número de Linha', tipologyKey: 'atendimento' },
  'Info_Obrigatória.csv':  { modalidade: 'Informações Obrigatórias Gerais', tipologyKey: 'atendimento' },
  'Instalação.csv':        { modalidade: 'Instalação, Ativação ou Habilitação', tipologyKey: 'qualidade' },
  'Mudança.csv':           { modalidade: 'Mudança de Endereço', tipologyKey: 'atendimento' },
  'Plano.csv':             { modalidade: 'Plano de Serviço, Oferta, Bônus, Promoções', tipologyKey: 'plano_servicos' },
  'Portabilidade.csv':     { modalidade: 'Portabilidade', tipologyKey: 'portabilidade' },
  'Qualidade.csv':         { modalidade: 'Qualidade, Funcionamento e Reparo', tipologyKey: 'qualidade' },
  'Ressarcimento.csv':     { modalidade: 'Ressarcimento', tipologyKey: 'cobranca' },
};

interface RegulatoryItem {
  number: string;
  item: string;
  whenToUse: string;
  mandatoryInfo: string;
  responseSuggestion: string;
}

function parseRegulatoryCSV(filePath: string): RegulatoryItem[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows: string[][] = parse(raw, { bom: true, relax_column_count: true });

  // Find header row (contains "#", "ITENS", etc.)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(c => c.trim() === '#' || c.trim() === 'ITENS')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const items: RegulatoryItem[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const item = (row[1] ?? '').trim();
    if (!item) continue;

    items.push({
      number: (row[0] ?? '').trim(),
      item,
      whenToUse: (row[2] ?? '').trim(),
      mandatoryInfo: (row[3] ?? '').trim(),
      responseSuggestion: (row[4] ?? '').trim(),
    });
  }
  return items;
}

function buildChunkContent(item: RegulatoryItem, modalidade: string): string {
  const parts = [`[${modalidade}] Item #${item.number}`, ''];

  parts.push(`REGRA: ${item.item}`);
  if (item.whenToUse) parts.push(`QUANDO USAR: ${item.whenToUse}`);
  if (item.mandatoryInfo) parts.push(`INFORMAÇÕES OBRIGATÓRIAS: ${item.mandatoryInfo}`);
  if (item.responseSuggestion) parts.push(`MODELO DE RESPOSTA: ${item.responseSuggestion}`);

  return parts.join('\n');
}

async function main() {
  const csvFolder = process.argv[2];
  if (!csvFolder) {
    console.error('Usage: ts-node scripts/seed-kb-regulatory.ts <csv-folder-path>');
    process.exit(1);
  }

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

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Load tipology map
  const tipRows = await ds.query('SELECT id, key FROM tipology');
  const tipMap = new Map<string, string>(tipRows.map((r: any) => [r.key, r.id]));

  let totalDocs = 0;
  let totalChunks = 0;

  const csvFiles = Object.keys(FILE_MAP).filter(f => {
    const p = path.join(csvFolder, f);
    return fs.existsSync(p);
  });

  console.log(`Found ${csvFiles.length} regulatory CSV files\n`);

  for (const fileName of csvFiles) {
    const filePath = path.join(csvFolder, fileName);
    const meta = FILE_MAP[fileName];
    const items = parseRegulatoryCSV(filePath);

    if (items.length === 0) {
      console.log(`  ${fileName}: empty, skipping`);
      continue;
    }

    const docTitle = `Regulatório Anatel - ${meta.modalidade}`;

    // Check if document already exists
    const existing = await ds.query(
      'SELECT id FROM kb_document WHERE title = $1',
      [docTitle],
    );
    if (existing.length > 0) {
      console.log(`  ${fileName}: skip (document "${docTitle}" already exists)`);
      continue;
    }

    // 1. Create kb_document
    const [doc] = await ds.query(
      `INSERT INTO kb_document (title, "sourceType", "filePath", "mimeType", "isActive")
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [docTitle, 'regulatory_csv', filePath, 'text/csv'],
    );
    const documentId = doc.id;

    // 2. Create kb_document_version
    const [ver] = await ds.query(
      `INSERT INTO kb_document_version (version, "changeDescription", "processedAt", "chunkCount", "isActive", "documentId")
       VALUES (1, $1, NOW(), $2, true, $3) RETURNING id`,
      [`Import de ${items.length} itens regulatórios de ${fileName}`, items.length, documentId],
    );
    const versionId = ver.id;

    // 3. Create chunks with embeddings (batch 20 at a time for efficiency)
    const batchSize = 20;
    for (let b = 0; b < items.length; b += batchSize) {
      const batch = items.slice(b, b + batchSize);
      const contents = batch.map(it => buildChunkContent(it, meta.modalidade));

      // Generate embeddings in batch
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: contents.map(c => c.substring(0, 2000)),
      });

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const content = contents[j];
        const embedding = embResponse.data[j].embedding;
        const embVector = `[${embedding.join(',')}]`;
        const tipologyId = tipMap.get(meta.tipologyKey) ?? null;

        await ds.query(
          `INSERT INTO kb_chunk (content, "chunkIndex", "sectionTitle", metadata, embedding, "documentVersionId")
           VALUES ($1, $2, $3, $4, $5::vector, $6)`,
          [
            content,
            b + j,
            `${meta.modalidade} - Item #${item.number}`,
            JSON.stringify({
              modalidade: meta.modalidade,
              tipologyKey: meta.tipologyKey,
              tipologyId,
              itemNumber: item.number,
              whenToUse: item.whenToUse,
              mandatoryInfo: item.mandatoryInfo,
              source: fileName,
            }),
            embVector,
            versionId,
          ],
        );
        totalChunks++;
      }
    }

    totalDocs++;
    console.log(`  ✓ ${fileName}: ${items.length} itens → "${docTitle}"`);
  }

  await ds.destroy();
  console.log(`\nDone: ${totalDocs} documents, ${totalChunks} chunks imported`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
