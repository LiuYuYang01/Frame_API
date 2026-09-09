import { BeforeInsert, BeforeUpdate, Entity, Column, PrimaryGeneratedColumn, ManyToMany } from 'typeorm';

const PHOTO_NAME_PATTERN = /^[0-9a-z]{10}$/;

const normalizePhotoName = (name: string): string => {
  if (PHOTO_NAME_PATTERN.test(name)) return name;
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};
import { Album } from './album';

@Entity('photo')
export class Photo {
  @BeforeInsert()
  @BeforeUpdate()
  normalizeName() {
    this.name = normalizePhotoName(this.name);
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '图片名称' })
  name: string;

  @Column({ comment: '图片描述', nullable: true })
  description?: string;

  @Column({ comment: '图片URL地址' })
  url: string;

  @Column({ comment: '文件大小（字节）' })
  size: number;

  @Column({ comment: '图片宽度（像素）', nullable: true })
  width: number;

  @Column({ comment: '图片高度（像素）', nullable: true })
  height: number;

  @Column({ comment: '图片格式/MIME类型' })
  type: string;

  @Column({ comment: '文件哈希值（用于秒传）', nullable: true })
  hash?: string;

  @Column({ comment: '是否收藏', default: false })
  is_featured: boolean;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  create_time: Date;

  // 多对多关系：一张照片可以属于多个相册
  @ManyToMany(() => Album, (album) => album.photos)
  albums: Album[];
}
