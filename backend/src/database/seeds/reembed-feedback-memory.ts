/**
 * One-off backfill: re-embeds every human_feedback_memory row using the COMPLAINT
 * text (normalizedText ?? rawText) instead of the AI draft text that earlier
 * phases embedded. Required so old memories participate correctly in the
 * DraftFinalResponse retrieval, which searches with the new complaint's embedding.
 *
 * Idempotent — safe to re-run. Rows whose complaint has no text fall back to aiText.
 *
 * Run: npm run reembed:feedback   (inside backend/, with .env configured)
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { embed } from 'ai';
import * as pgvector from 'pgvector/pg';
import { AppModule } from '../../app.module';
import { ModelSelectorService } from '../../modules/ia/services/model-selector.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  const modelSelector = app.get(ModelSelectorService);
  const embeddingModel = await modelSelector.getEmbeddingModel();

  const rows: Array<{ id: string; text: string | null; aiText: string }> =
    await dataSource.query(
      `SELECT hfm.id, COALESCE(NULLIF(c."normalizedText", ''), c."rawText") AS text, hfm."aiText"
       FROM human_feedback_memory hfm
       LEFT JOIN complaint c ON c.id = hfm."complaintId"`,
    );
  console.log(`Re-embedding ${rows.length} human_feedback_memory rows...`);

  let done = 0;
  let fallbacks = 0;
  for (const row of rows) {
    const value = row.text?.trim() || row.aiText;
    if (!row.text?.trim()) fallbacks++;
    const { embedding } = await embed({ model: embeddingModel, value });
    await dataSource.query(
      `UPDATE human_feedback_memory SET embedding = $1::vector WHERE id = $2`,
      [pgvector.toSql(embedding), row.id],
    );
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length}`);
  }
  console.log(`Done: ${done}/${rows.length} re-embedded (${fallbacks} fell back to aiText).`);
  await app.close();
}

main().catch((err) => {
  console.error('Re-embed failed:', err);
  process.exit(1);
});
