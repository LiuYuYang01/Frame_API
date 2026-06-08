/** 触发瘦身的默认最小文件体积（500KB） */
export const DEFAULT_SLIM_MIN_SIZE_BYTES = 500 * 1024;

/** 瘦身后的默认长边上限（与上传压缩一致） */
export const DEFAULT_SLIM_MAX_LONG_EDGE = 2560;

/** pfop 输出 JPEG 质量（1-100），默认与上传「推荐」一致 */
export const DEFAULT_SLIM_QUALITY = 50;

/** pfop 轮询间隔（毫秒） */
export const PFOP_POLL_INTERVAL_MS = 1500;

/** 单张图片 pfop 最长等待时间（毫秒） */
export const PFOP_MAX_WAIT_MS = 120_000;
