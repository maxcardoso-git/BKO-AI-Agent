import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplaintMissingFields1773870000000 implements MigrationInterface {
  name = 'AddComplaintMissingFields1773870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE complaint
      ADD COLUMN IF NOT EXISTS "idtSolicitacao" varchar,
      ADD COLUMN IF NOT EXISTS "idInstancia" varchar,
      ADD COLUMN IF NOT EXISTS "idTarefa" varchar,
      ADD COLUMN IF NOT EXISTS "dataDocumento" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "dataEvento" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "primeiroServico" varchar,
      ADD COLUMN IF NOT EXISTS "responsavelTabulacaoD0" varchar,
      ADD COLUMN IF NOT EXISTS "dataTabulacaoD0" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "telefoneContatoFixo" varchar,
      ADD COLUMN IF NOT EXISTS "telefoneReclamado" varchar,
      ADD COLUMN IF NOT EXISTS "cpfCnpjCliente" varchar,
      ADD COLUMN IF NOT EXISTS "cpfCnpjAssinante" varchar,
      ADD COLUMN IF NOT EXISTS "nomeAssinante" varchar,
      ADD COLUMN IF NOT EXISTS "responsavel" varchar,
      ADD COLUMN IF NOT EXISTS "supervisor" varchar,
      ADD COLUMN IF NOT EXISTS "coordenador" varchar,
      ADD COLUMN IF NOT EXISTS "justificativa" text,
      ADD COLUMN IF NOT EXISTS "situacaoAnatel" varchar,
      ADD COLUMN IF NOT EXISTS "pendenciaFutura" varchar,
      ADD COLUMN IF NOT EXISTS "motivoPendenciaFutura" varchar,
      ADD COLUMN IF NOT EXISTS "dataPendenciaFutura" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "statusProcesso" varchar,
      ADD COLUMN IF NOT EXISTS "dataIda" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "motivoReincidente" varchar,
      ADD COLUMN IF NOT EXISTS "detalhamentoMotivoReincidente" varchar,
      ADD COLUMN IF NOT EXISTS "ultimaIteracao" varchar,
      ADD COLUMN IF NOT EXISTS "avaliacao" varchar,
      ADD COLUMN IF NOT EXISTS "realizarIncentivo" varchar,
      ADD COLUMN IF NOT EXISTS "telefoneWhatsapp" varchar,
      ADD COLUMN IF NOT EXISTS "idProntaParaContato" varchar,
      ADD COLUMN IF NOT EXISTS "dataEnvioPodeFalarAgora" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "dataRetornoFalarAgora" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "retornoHorarioOperacional" varchar,
      ADD COLUMN IF NOT EXISTS "retornoFalarAgora" varchar,
      ADD COLUMN IF NOT EXISTS "clienteFavoravel" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      'idtSolicitacao', 'idInstancia', 'idTarefa', 'dataDocumento', 'dataEvento',
      'primeiroServico', 'responsavelTabulacaoD0', 'dataTabulacaoD0',
      'telefoneContatoFixo', 'telefoneReclamado', 'cpfCnpjCliente', 'cpfCnpjAssinante',
      'nomeAssinante', 'responsavel', 'supervisor', 'coordenador', 'justificativa',
      'situacaoAnatel', 'pendenciaFutura', 'motivoPendenciaFutura', 'dataPendenciaFutura',
      'statusProcesso', 'dataIda', 'motivoReincidente', 'detalhamentoMotivoReincidente',
      'ultimaIteracao', 'avaliacao', 'realizarIncentivo', 'telefoneWhatsapp',
      'idProntaParaContato', 'dataEnvioPodeFalarAgora', 'dataRetornoFalarAgora',
      'retornoHorarioOperacional', 'retornoFalarAgora', 'clienteFavoravel',
    ];
    for (const col of cols) {
      await queryRunner.query(`ALTER TABLE complaint DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
