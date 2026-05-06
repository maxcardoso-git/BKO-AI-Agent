import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PIPE-01: Reduce regulatory pipeline from 16 active steps to 14.
 *
 * Deactivates step_definition rows whose key matches retrieve_discount* or retrieve_invoice*
 * (any case convention: CamelCase, snake_case, etc.).
 *
 * Note on preservation (PIPE-04 — historical audit):
 * - The RetrieveDiscounts and RetrieveInvoices skill code in skill-registry.service.ts is KEPT.
 * - The `discount` and `invoice` tables are NOT dropped.
 * - The step_skill_binding rows are NOT deleted.
 * - Deactivation flows exclusively from step_definition.isActive = false.
 * - If anyone manually re-activates these steps, dispatch still works end-to-end.
 */
export class DeactivateRetrieveDiscountAndInvoiceSteps1773900002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PIPE-01: Deactivate retrieve_discount* and retrieve_invoice* steps across ALL capability versions.
    // The 4 LIKE clauses cover all naming conventions:
    //   - snake_case: retrieve_discounts, retrieve_invoices (matches %retrieve_discount%, %retrieve_invoice%)
    //   - CamelCase:  RetrieveDiscounts, RetrieveInvoices  (LOWER → 'retrievediscounts', matches %retrievediscount%)
    await queryRunner.query(`
      UPDATE "step_definition"
         SET "isActive" = false,
             "updatedAt" = now()
       WHERE LOWER("key") LIKE '%retrieve_discount%'
          OR LOWER("key") LIKE '%retrieve_invoice%'
          OR LOWER("key") LIKE '%retrievediscount%'
          OR LOWER("key") LIKE '%retrieveinvoice%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Inverse: re-activate the same rows
    await queryRunner.query(`
      UPDATE "step_definition"
         SET "isActive" = true,
             "updatedAt" = now()
       WHERE LOWER("key") LIKE '%retrieve_discount%'
          OR LOWER("key") LIKE '%retrieve_invoice%'
          OR LOWER("key") LIKE '%retrievediscount%'
          OR LOWER("key") LIKE '%retrieveinvoice%'
    `);
  }
}
