import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CapabilityVersion } from './capability-version.entity';

@Entity('step_definition')
export class StepDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  key: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  stepOrder: number;

  @Column({ type: 'boolean', default: false })
  isHumanRequired: boolean;

  @Column({ type: 'int', nullable: true })
  timeoutSeconds: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => CapabilityVersion, (version) => version.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capabilityVersionId' })
  capabilityVersion: CapabilityVersion;

  @Column({ type: 'uuid' })
  capabilityVersionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
