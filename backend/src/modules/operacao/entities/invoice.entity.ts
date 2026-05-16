import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('invoice')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  protocolNumber: string;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'varchar' })
  planName: string;

  @Column({ type: 'real' })
  planFullPrice: number;

  @Column({ type: 'real' })
  invoiceAmount: number;

  @Column({ type: 'real', default: 0 })
  fineAmount: number;

  @Column({ type: 'real', default: 0 })
  interestAmount: number;

  @Column({ type: 'real' })
  totalAmount: number;

  @Column({ type: 'date', nullable: true })
  consumptionStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  consumptionEndDate: Date | null;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
