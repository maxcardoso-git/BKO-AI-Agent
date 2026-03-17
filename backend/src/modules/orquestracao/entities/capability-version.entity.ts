import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Capability } from './capability.entity';
import { StepDefinition } from './step-definition.entity';

@Entity('capability_version')
export class CapabilityVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isCurrent: boolean;

  @ManyToOne(() => Capability, (capability) => capability.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capabilityId' })
  capability: Capability;

  @Column({ type: 'uuid' })
  capabilityId: string;

  @OneToMany(() => StepDefinition, (step) => step.capabilityVersion)
  steps: StepDefinition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
