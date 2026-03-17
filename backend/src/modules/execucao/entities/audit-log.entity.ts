import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
