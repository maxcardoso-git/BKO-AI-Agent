import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/** Stores per-user turbina import filter selections so the operator does not
 *  have to re-tick the same combinations on every CSV upload. One row per user. */
@Entity('turbina_import_preset')
@Unique(['userId'])
export class TurbinaImportPreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** Shape: { "Serviço": ["...", ...], "Modalidade": [...], ... } */
  @Column({ type: 'jsonb' })
  filters: Record<string, string[]>;

  @UpdateDateColumn()
  updatedAt: Date;
}
