import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('env_config')
export class EnvConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, comment: '配置名称' })
  name: string;

  @Column({ type: 'json', nullable: true, comment: '配置值(JSON格式)' })
  value: Record<string, unknown>;

  @Column({ nullable: true, comment: '配置备注' })
  notes: string;
}
