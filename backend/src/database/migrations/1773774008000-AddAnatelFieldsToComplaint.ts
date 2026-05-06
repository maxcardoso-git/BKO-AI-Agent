import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnatelFieldsToComplaint1773774008000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "complaint"
        ADD COLUMN IF NOT EXISTS "modalidade"           VARCHAR,
        ADD COLUMN IF NOT EXISTS "motivo"               VARCHAR,
        ADD COLUMN IF NOT EXISTS "servicoPrincipal"     VARCHAR,
        ADD COLUMN IF NOT EXISTS "canalEntrada"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "acao"                 VARCHAR,
        ADD COLUMN IF NOT EXISTS "perfilResponsavel"    VARCHAR,
        ADD COLUMN IF NOT EXISTS "resposta"             TEXT,
        ADD COLUMN IF NOT EXISTS "clienteNome"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "clienteUF"            VARCHAR,
        ADD COLUMN IF NOT EXISTS "clienteCidade"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "clienteTipoPessoa"    VARCHAR,
        ADD COLUMN IF NOT EXISTS "nota"                 DECIMAL(5,3),
        ADD COLUMN IF NOT EXISTS "protocoloPrestadora"  VARCHAR,
        ADD COLUMN IF NOT EXISTS "dataCadastro"         TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "dataFinalizacao"      TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "anatelMetadata"       JSONB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "complaint"
        DROP COLUMN IF EXISTS "modalidade",
        DROP COLUMN IF EXISTS "motivo",
        DROP COLUMN IF EXISTS "servicoPrincipal",
        DROP COLUMN IF EXISTS "canalEntrada",
        DROP COLUMN IF EXISTS "acao",
        DROP COLUMN IF EXISTS "perfilResponsavel",
        DROP COLUMN IF EXISTS "resposta",
        DROP COLUMN IF EXISTS "clienteNome",
        DROP COLUMN IF EXISTS "clienteUF",
        DROP COLUMN IF EXISTS "clienteCidade",
        DROP COLUMN IF EXISTS "clienteTipoPessoa",
        DROP COLUMN IF EXISTS "nota",
        DROP COLUMN IF EXISTS "protocoloPrestadora",
        DROP COLUMN IF EXISTS "dataCadastro",
        DROP COLUMN IF EXISTS "dataFinalizacao",
        DROP COLUMN IF EXISTS "anatelMetadata"
    `);
  }
}
