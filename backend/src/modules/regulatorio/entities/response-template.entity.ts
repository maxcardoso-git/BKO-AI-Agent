import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tipology } from './tipology.entity';
import { Situation } from './situation.entity';

@Entity('response_template')
export class ResponseTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text' })
  templateContent: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', nullable: true })
  sourceDocument: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @ManyToOne(() => Situation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'situationId' })
  situation: Situation | null;

  @Column({ type: 'uuid', nullable: true })
  situationId: string | null;

  /** Cache of LLM-extracted required input fields parsed from the
   *  "INFORMAÇÕES OBRIGATÓRIAS:" section of templateContent. Lazy-populated
   *  on the first /template-fields call so the operator UI does not pay the
   *  LLM round-trip on every pull. */
  @Column({ type: 'jsonb', nullable: true })
  requiredFieldsCache: { fields: Array<{ key: string; label: string; type: 'date' | 'number' | 'text' }> } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
