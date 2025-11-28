# 七牛云文件上传 API 文档

## 基础信息

- **基础URL**: `http://localhost:6666/api` (开发环境)
- **API前缀**: `/api`
- **认证方式**: JWT Bearer Token
- **Content-Type**: 
  - JSON: `application/json`
  - 文件上传: `multipart/form-data`

## 统一响应格式

所有接口统一返回以下格式：

```json
{
  "code": 200,        // 状态码：200 成功，400+ 失败
  "message": "ok",    // 响应消息
  "data": {}          // 响应数据
}
```

## 错误响应格式

```json
{
  "code": 400,
  "message": "错误描述信息",
  "data": null
}
```

---

## 接口列表

### 1. 普通文件上传（批量上传）

支持一次性上传多个文件，自动检测秒传。

**接口地址**: `POST /api/qiniu/upload`

**请求头**:
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| files | File[] | 是 | 文件数组，最多10个 |
| albumId | number | 是 | 相册ID |

**支持的文件格式**: `jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp`

**请求示例**:
```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('albumId', '1');

fetch('http://localhost:6666/api/qiniu/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_token_here'
  },
  body: formData
});
```

**响应示例**:
```json
{
  "code": 200,
  "message": "上传成功",
  "data": [
    {
      "id": 1,
      "name": "abc123def456",
      "url": "http://store.liuyuyang.net/abc123def456.jpg",
      "size": 2048576,
      "width": 1920,
      "height": 1080,
      "type": "image/jpeg",
      "hash": "Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1",
      "create_time": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 2. 秒传检查

在上传前检查文件是否已存在，如果存在则无需上传。

**接口地址**: `POST /api/qiniu/check_instant_upload`

**请求头**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| hash | string | 是 | 文件哈希值（MD5或etag） |
| fileSize | number | 是 | 文件大小（字节） |

**请求示例**:
```javascript
fetch('http://localhost:6666/api/qiniu/check_instant_upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_token_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hash: 'Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1',
    fileSize: 10485760
  })
});
```

**响应示例（文件已存在）**:
```json
{
  "code": 200,
  "message": "文件已存在，可直接使用",
  "data": {
    "id": 1,
    "name": "abc123def456",
    "url": "http://store.liuyuyang.net/abc123def456.jpg",
    "size": 10485760,
    "width": 1920,
    "height": 1080,
    "type": "image/jpeg",
    "hash": "Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1",
    "create_time": "2024-01-15T10:30:00.000Z"
  }
}
```

**响应示例（文件不存在）**:
```json
{
  "code": 200,
  "message": "文件不存在，需要上传",
  "data": null
}
```

---

### 3. 分片上传

支持大文件分片上传，自动实现断点续传。

**接口地址**: `POST /api/qiniu/chunk_upload`

**请求头**:
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| chunk | File | 是 | 分片文件 |
| uploadId | string | 是 | 上传ID（用于标识同一个文件的上传会话） |
| chunkIndex | number | 是 | 分片索引（从0开始） |
| totalChunks | number | 是 | 总分片数 |
| fileSize | number | 是 | 文件总大小（字节） |
| fileName | string | 是 | 原始文件名 |
| key | string | 否 | 文件key（可选，不传则自动生成） |
| hash | string | 否 | 文件哈希值（用于秒传） |
| albumId | number | 否 | 相册ID（可选，上传完成后自动添加到相册） |

**请求示例**:
```javascript
const formData = new FormData();
formData.append('chunk', chunkBlob);
formData.append('uploadId', 'upload_1234567890');
formData.append('chunkIndex', '0');
formData.append('totalChunks', '10');
formData.append('fileSize', '10485760');
formData.append('fileName', 'photo.jpg');
formData.append('albumId', '1');

fetch('http://localhost:6666/api/qiniu/chunk_upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_token_here'
  },
  body: formData
});
```

**响应示例（分片上传中）**:
```json
{
  "code": 200,
  "message": "分片上传成功",
  "data": {
    "uploaded": [0, 1, 2],
    "completed": false
  }
}
```

**响应示例（所有分片上传完成）**:
```json
{
  "code": 200,
  "message": "分片上传完成",
  "data": {
    "uploaded": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    "completed": true,
    "key": "abc123def456.jpg",
    "hash": "Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1",
    "photo": {
      "id": 1,
      "name": "photo",
      "url": "http://store.liuyuyang.net/abc123def456.jpg",
      "size": 10485760,
      "width": 1920,
      "height": 1080,
      "type": "image/jpeg",
      "hash": "Fp8xqN2K8k-0Wh8Lv00YV3x9o2T1",
      "create_time": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 4. 获取上传进度

查询已上传的分片索引，用于断点续传。

**接口地址**: `GET /api/qiniu/upload-progress`

**请求头**:
```
Authorization: Bearer {token}
```

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| uploadId | string | 是 | 上传ID |

**请求示例**:
```javascript
fetch('http://localhost:6666/api/qiniu/upload-progress?uploadId=upload_1234567890', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
});
```

**响应示例**:
```json
{
  "code": 200,
  "message": "获取上传进度成功",
  "data": {
    "uploadId": "upload_1234567890",
    "uploadedChunks": [0, 1, 2, 3, 4],
    "progress": 5
  }
}
```

---

### 5. 取消上传

取消上传并清理临时文件。

**接口地址**: `DELETE /api/qiniu/cancel_upload`

**请求头**:
```
Authorization: Bearer {token}
```

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| uploadId | string | 是 | 上传ID |

**请求示例**:
```javascript
fetch('http://localhost:6666/api/qiniu/cancel_upload?uploadId=upload_1234567890', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
});
```

**响应示例**:
```json
{
  "code": 200,
  "message": "已取消上传",
  "data": null
}
```

---

## 前端实现示例

### 1. 普通上传（带秒传检查）

```javascript
async function uploadFile(file, albumId) {
  // 1. 先计算文件hash
  const hash = await calculateFileHash(file);
  
  // 2. 检查秒传
  const checkResponse = await fetch('http://localhost:6666/api/qiniu/check_instant_upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hash: hash,
      fileSize: file.size
    })
  });
  
  const checkResult = await checkResponse.json();
  
  // 3. 如果已存在，直接返回
  if (checkResult.data) {
    return checkResult.data;
  }
  
  // 4. 如果不存在，执行上传
  const formData = new FormData();
  formData.append('files', file);
  formData.append('albumId', albumId);
  
  const uploadResponse = await fetch('http://localhost:6666/api/qiniu/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const uploadResult = await uploadResponse.json();
  return uploadResult.data[0];
}

// 计算文件MD5哈希
function calculateFileHash(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async (e) => {
      const buffer = e.target.result;
      const hashBuffer = await crypto.subtle.digest('MD5', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      resolve(hashHex);
    };
    reader.onerror = reject;
  });
}
```

### 2. 分片上传（带断点续传）

```javascript
async function uploadFileByChunks(file, albumId, chunkSize = 4 * 1024 * 1024) {
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // 1. 检查上传进度（断点续传）
  const progressResponse = await fetch(
    `http://localhost:6666/api/qiniu/upload-progress?uploadId=${uploadId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  const progressResult = await progressResponse.json();
  const uploadedChunks = progressResult.data.uploadedChunks || [];
  
  // 2. 上传未完成的分片
  for (let i = 0; i < totalChunks; i++) {
    // 跳过已上传的分片
    if (uploadedChunks.includes(i)) {
      continue;
    }
    
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileSize', file.size.toString());
    formData.append('fileName', file.name);
    formData.append('albumId', albumId);
    
    const response = await fetch('http://localhost:6666/api/qiniu/chunk_upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    // 如果所有分片上传完成，返回结果
    if (result.data.completed) {
      return result.data.photo;
    }
    
    // 更新进度
    console.log(`上传进度: ${result.data.uploaded.length}/${totalChunks}`);
  }
}

// 取消上传
async function cancelUpload(uploadId) {
  await fetch(`http://localhost:6666/api/qiniu/cancel_upload?uploadId=${uploadId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}
```

---

## 注意事项

1. **认证**: 所有接口都需要在请求头中携带 JWT Token
   ```
   Authorization: Bearer {your_token}
   ```

2. **文件格式限制**: 仅支持图片格式：`jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp`

3. **批量上传限制**: 单次最多上传 10 个文件

4. **分片大小建议**: 推荐使用 4MB 作为分片大小，可根据网络情况调整

5. **秒传机制**: 
   - 系统会自动计算文件 MD5 哈希值
   - 如果数据库中已存在相同 hash 的文件，会直接复用，无需重复上传
   - 建议在上传前先调用秒传检查接口

6. **断点续传**:
   - 使用相同的 `uploadId` 可以继续上传未完成的分片
   - 上传前先调用获取进度接口，跳过已上传的分片

7. **错误处理**: 
   - 所有错误都会返回统一的错误格式
   - 上传失败时会自动回滚已上传的文件

8. **相册关联**: 
   - 普通上传必须指定 `albumId`
   - 分片上传的 `albumId` 为可选，如果提供，上传完成后会自动添加到相册

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（Token无效或过期） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 更新日志

- **v1.0.0** (2024-01-15)
  - 实现普通文件上传（批量上传）
  - 实现秒传检查功能
  - 实现分片上传功能
  - 实现断点续传功能
  - 实现上传进度查询
  - 实现取消上传功能

