import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('discount')
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  protocolNumber: string;

  @Column({ type: 'varchar' })
  discountName: string;

  @Column({ type: 'real' })
  discountPercent: number;

  @Column({ type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ type: 'date', nullable: true })
  loyaltyStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  loyaltyEndDate: Date | null;

  @Column({ type: 'date', nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
