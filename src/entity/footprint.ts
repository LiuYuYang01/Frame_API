import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('footprint')
export class Footprint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '标题' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '内容描述' })
  content: string;

  @Column({ nullable: true, comment: '地址' })
  address: string;

  @Column({ nullable: true, comment: '位置坐标（经纬度，格式：lng,lat）' })
  position: string;

  @Column({ nullable: true, comment: '封面图片URL' })
  cover: string;

  @Column({ nullable: true, comment: '关联相册ID' })
  album_id: number;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间',
  })
  create_time: Date;
}
