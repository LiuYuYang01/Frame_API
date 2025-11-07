import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Photo } from './photo';

@Entity('album')
export class Album {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '相册名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '相册描述' })
  description: string;

  @Column({ nullable: true, comment: '封面图片URL' })
  cover: string;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  create_time: Date;

  // 多对多关系：一个相册可以包含多张照片
  // JoinTable 装饰器放在关系的拥有方
  @ManyToMany(() => Photo, (photo) => photo.albums)
  @JoinTable({
    name: 'album_photo', // 中间表名称
    joinColumn: { name: 'album_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'photo_id', referencedColumnName: 'id' },
  })
  photos: Photo[];
}
