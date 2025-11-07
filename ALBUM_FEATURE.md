# 相册功能文档

## 功能概述

本项目新增了完整的相册和照片管理功能，主要特性包括：

- **照片管理**：照片的增删改查，自动保存图片元数据（尺寸、大小、格式等）
- **相册管理**：相册的增删改查
- **多对多关系**：一个相册可以包含多张照片，一张照片可以属于多个相册
- **七牛云集成**：上传图片到七牛云后自动创建照片记录

## 数据模型

### Photo（照片）实体

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| name | string | 图片名称 |
| key | string | 七牛云文件key |
| url | string | 图片URL地址 |
| size | number | 文件大小（字节）|
| width | number | 图片宽度（像素）|
| height | number | 图片高度（像素）|
| mime_type | string | 图片格式/MIME类型 |
| hash | string | 文件hash值 |
| create_time | Date | 创建时间 |
| albums | Album[] | 所属相册列表（多对多关系）|

### Album（相册）实体

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键 |
| name | string | 相册名称 |
| description | string | 相册描述 |
| cover | string | 封面图片URL |
| create_time | Date | 创建时间 |
| update_time | Date | 更新时间 |
| photos | Photo[] | 包含的照片列表（多对多关系）|

## API 接口

### 照片管理接口

#### 1. 创建照片
```
POST /photo
```
**请求体**：
```json
{
  "name": "sunset.jpg",
  "key": "2024_01_15_123456_abc123.jpg",
  "url": "https://cdn.example.com/2024_01_15_123456_abc123.jpg",
  "size": 2048576,
  "width": 1920,
  "height": 1080,
  "mime_type": "image/jpeg",
  "hash": "FhGxwENMYuGu8sLF8cFFGSGhN4Fi"
}
```

#### 2. 查询照片列表
```
GET /photo?page=1&limit=10&keyword=sunset
```
**查询参数**：
- `page`: 页码（默认：1）
- `limit`: 每页数量（默认：10）
- `keyword`: 搜索关键词（可选）

#### 3. 查询照片详情
```
GET /photo/:id
```

#### 4. 更新照片
```
PATCH /photo/:id
```
**请求体**：
```json
{
  "name": "new_name.jpg"
}
```

#### 5. 删除照片
```
DELETE /photo/:id
```

### 相册管理接口

#### 1. 创建相册
```
POST /album
```
**请求体**：
```json
{
  "name": "旅行相册",
  "description": "2024年春节旅行照片",
  "cover": "https://cdn.example.com/cover.jpg"
}
```

#### 2. 查询相册列表
```
GET /album?page=1&limit=10&keyword=旅行
```
**查询参数**：
- `page`: 页码（默认：1）
- `limit`: 每页数量（默认：10）
- `keyword`: 搜索关键词（可选）

#### 3. 查询相册详情
```
GET /album/:id
```
返回相册信息及包含的所有照片。

#### 4. 更新相册
```
PATCH /album/:id
```
**请求体**：
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "cover": "https://cdn.example.com/new_cover.jpg"
}
```

#### 5. 删除相册
```
DELETE /album/:id
```
注意：删除相册不会删除照片本身。

#### 6. 添加照片到相册
```
POST /album/:id/photos
```
**请求体**：
```json
{
  "photo_ids": [1, 2, 3]
}
```

#### 7. 从相册移除照片
```
DELETE /album/:id/photos
```
**请求体**：
```json
{
  "photo_ids": [1, 2]
}
```
注意：移除照片不会删除照片本身。

#### 8. 获取相册中的所有照片
```
GET /album/:id/photos
```

### 七牛云上传接口（增强版）

#### 上传文件
```
POST /qiniu/upload
```
**请求**：multipart/form-data，字段名为 `files`

**响应示例**：
```json
{
  "code": 200,
  "message": "成功上传 2 个文件",
  "data": [
    {
      "id": 1,
      "name": "sunset.jpg",
      "key": "2024_01_15_123456_abc123.jpg",
      "url": "https://cdn.example.com/2024_01_15_123456_abc123.jpg",
      "size": 2048576,
      "width": 1920,
      "height": 1080,
      "mime_type": "image/jpeg",
      "hash": "FhGxwENMYuGu8sLF8cFFGSGhN4Fi",
      "create_time": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "beach.jpg",
      "key": "2024_01_15_123457_def456.jpg",
      "url": "https://cdn.example.com/2024_01_15_123457_def456.jpg",
      "size": 1567890,
      "width": 1280,
      "height": 720,
      "mime_type": "image/jpeg",
      "hash": "FhGxwENMYuGu8sLF8cFFGSGhN4Fj",
      "create_time": "2024-01-15T10:30:05.000Z"
    }
  ]
}
```

**新功能**：
- 上传成功后自动创建照片记录
- 自动获取并保存图片的尺寸信息（宽度、高度）
- 自动保存文件大小、MIME类型、hash等元数据
- 返回完整的照片对象，包含数据库ID

## 使用流程

### 典型使用场景

#### 场景1：上传图片并创建相册

1. **上传图片到七牛云**
```bash
POST /qiniu/upload
# 上传文件，返回照片对象（包含ID）
```

2. **创建相册**
```bash
POST /album
{
  "name": "我的相册",
  "description": "相册描述",
  "cover": "照片URL"
}
# 返回相册对象（包含ID）
```

3. **添加照片到相册**
```bash
POST /album/{相册ID}/photos
{
  "photo_ids": [照片ID1, 照片ID2, ...]
}
```

#### 场景2：查看相册内容

1. **查询相册列表**
```bash
GET /album?page=1&limit=10
```

2. **查看相册详情和照片**
```bash
GET /album/{相册ID}
# 或
GET /album/{相册ID}/photos
```

#### 场景3：管理相册照片

1. **添加新照片到已有相册**
```bash
# 先上传新照片
POST /qiniu/upload

# 然后添加到相册
POST /album/{相册ID}/photos
{
  "photo_ids": [新照片ID]
}
```

2. **从相册移除照片**
```bash
DELETE /album/{相册ID}/photos
{
  "photo_ids": [要移除的照片ID]
}
```

## 数据库表结构

### photo 表
```sql
CREATE TABLE `photo` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '图片名称',
  `key` VARCHAR(255) NOT NULL COMMENT '七牛云文件key',
  `url` VARCHAR(512) NOT NULL COMMENT '图片URL地址',
  `size` INT NOT NULL COMMENT '文件大小（字节）',
  `width` INT COMMENT '图片宽度（像素）',
  `height` INT COMMENT '图片高度（像素）',
  `mime_type` VARCHAR(100) NOT NULL COMMENT '图片格式/MIME类型',
  `hash` VARCHAR(255) NOT NULL COMMENT '文件hash值',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
);
```

### album 表
```sql
CREATE TABLE `album` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '相册名称',
  `description` TEXT COMMENT '相册描述',
  `cover` VARCHAR(512) COMMENT '封面图片URL',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);
```

### album_photo 中间表（多对多关系）
```sql
CREATE TABLE `album_photo` (
  `album_id` INT NOT NULL,
  `photo_id` INT NOT NULL,
  PRIMARY KEY (`album_id`, `photo_id`),
  FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`photo_id`) REFERENCES `photo`(`id`) ON DELETE CASCADE
);
```

## 技术实现细节

### 1. 多对多关系实现

使用 TypeORM 的 `@ManyToMany` 和 `@JoinTable` 装饰器实现：

```typescript
// Album 实体（关系拥有方）
@ManyToMany(() => Photo, (photo) => photo.albums)
@JoinTable({
  name: 'album_photo',
  joinColumn: { name: 'album_id', referencedColumnName: 'id' },
  inverseJoinColumn: { name: 'photo_id', referencedColumnName: 'id' },
})
photos: Photo[];

// Photo 实体（关系反向方）
@ManyToMany(() => Album, (album) => album.photos)
albums: Album[];
```

### 2. 图片信息获取

使用七牛云的 `imageInfo` 接口获取图片尺寸：

```typescript
const imageInfoUrl = `${url}?imageInfo`;
const response = await fetch(imageInfoUrl);
const info = await response.json();
// info 包含: width, height, format, size, colorModel 等
```

### 3. 自动化流程

上传文件时的自动化流程：
1. 接收文件并上传到七牛云
2. 获取文件的基本信息（大小、MIME类型、hash）
3. 对于图片文件，获取尺寸信息（宽度、高度）
4. 自动创建 Photo 实体并保存到数据库
5. 返回完整的照片信息（包含数据库ID）

## API 文档

启动服务后访问 Swagger 文档：
```
http://localhost:3000/api
```

在 Swagger 文档中可以：
- 查看所有接口的详细说明
- 测试接口功能
- 查看请求/响应示例

## 注意事项

1. **权限控制**：所有接口都需要 JWT 认证（Bearer Token）
2. **级联删除**：删除相册不会删除照片，但会移除关联关系
3. **图片尺寸**：只有图片类型的文件才会获取尺寸信息
4. **七牛云配置**：需要正确配置七牛云的访问密钥和空间信息
5. **数据库同步**：开发环境下 `synchronize: true` 会自动创建表结构

## 后续优化建议

1. **性能优化**
   - 添加缓存机制（Redis）
   - 照片列表的延迟加载
   - 数据库索引优化

2. **功能增强**
   - 照片标签系统
   - 相册排序功能
   - 照片收藏功能
   - 图片压缩和处理
   - 批量操作优化

3. **安全增强**
   - 文件类型验证
   - 文件大小限制
   - 上传频率限制
   - 用户权限控制（区分公开/私有相册）

