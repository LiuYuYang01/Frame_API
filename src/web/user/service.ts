import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '@/entity/user';
import { LoginDto } from './dto/login';
import { UpdateProfileDto } from './dto/update_profile';
import { CustomException } from '@/execption/global_exception_handler';
import { QiniuService } from '@/web/upload/service';
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_MIME_TYPES } from '@/web/upload/config';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private qiniuService: QiniuService,
  ) {}

  private formatUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      create_time: user.create_time,
    };
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // 查找用户（使用 email 字段）
    const user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      throw new CustomException(400, '账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomException(400, '密码错误');
    }

    // 生成 JWT token 并设置有效期 3 天
    const token = this.jwtService.sign(
      { user_id: user.id },
      {
        expiresIn: '3d',
      },
    );

    // 返回用户信息（不包含密码）
    return {
      token,
      user: this.formatUser(user),
    };
  }

  /**
   * 更新当前用户资料
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new CustomException(400, '用户不存在');
    }

    const { username, name, old_password, new_password } = dto;

    if (username && username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username } });
      if (existing) {
        throw new CustomException(400, '账号已被占用');
      }
      user.username = username;
    }

    if (name) {
      user.name = name;
    }

    if (new_password) {
      const isPasswordValid = await bcrypt.compare(old_password || '', user.password);
      if (!isPasswordValid) {
        throw new CustomException(400, '当前密码错误');
      }
      user.password = await bcrypt.hash(new_password, 10);
    }

    await this.userRepository.save(user);

    return this.formatUser(user);
  }

  /**
   * 上传并更新用户头像
   */
  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new CustomException(400, '仅支持的图片格式：jpg、jpeg、png、gif、webp、bmp');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new CustomException(400, '头像文件不能超过 5MB');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new CustomException(400, '用户不存在');
    }

    const hash = crypto.createHash('md5').update(file.buffer).digest('hex');
    const key = `avatar/${userId}/${hash}${ext}`;
    const url = await this.qiniuService.getPublicDownloadUrl(key);

    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, key.replace(/\//g, '_'));

    try {
      await fs.promises.writeFile(tempFilePath, file.buffer);
      await this.qiniuService.uploadFile(tempFilePath, key);
    } finally {
      await fs.promises.unlink(tempFilePath).catch(() => undefined);
    }

    if (user.avatar) {
      try {
        const oldKey = this.qiniuService.extractKeyFromUrl(user.avatar);
        if (oldKey.startsWith(`avatar/${userId}/`)) {
          await this.qiniuService.delFile(oldKey);
        }
      } catch {
        // 忽略旧头像删除失败
      }
    }

    user.avatar = url;
    await this.userRepository.save(user);

    return this.formatUser(user);
  }
}
