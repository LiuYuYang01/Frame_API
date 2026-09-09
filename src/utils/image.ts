export type ImageScene = 'thumb' | 'grid' | 'preview' | 'cover' | 'placeholder';
export type ImageFormat = 'webp' | 'jpg' | 'png' | 'avif';

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  mode?: 1 | 2 | 3 | 4 | 5;
  quality?: number;
  format?: ImageFormat;
  interlace?: boolean;
  blur?: number;
  scene?: ImageScene;
}

export interface ImageQueryParams {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat;
  scene?: ImageScene;
}

const SCENE_PRESETS: Record<ImageScene, ImageProcessOptions> = {
  placeholder: { width: 20, mode: 1, quality: 50, blur: 20, format: 'webp' },
  thumb: { width: 300, height: 300, mode: 1, quality: 75, format: 'webp' },
  grid: { width: 540, mode: 2, quality: 80, format: 'webp' },
  preview: { width: 1920, mode: 2, quality: 90, interlace: true, format: 'webp' },
  cover: { width: 400, height: 400, mode: 1, quality: 80, format: 'webp' },
};

/** 去除七牛图片处理参数，还原原图 URL */
export const stripImageProcessing = (url: string): string => {
  if (!url) return '';
  const [base, query] = url.split('?');
  if (!query) return url;
  return query.startsWith('imageView2/') ? base : url;
};

/** @deprecated 使用 buildImageUrl */
export const buildImageView2Url = (url: string, width?: number, height?: number) => {
  return buildImageUrl(url, { width, height, mode: 1, quality: 75, format: 'webp' });
};

export const buildImageUrl = (url: string, options: ImageProcessOptions = {}): string => {
  if (!url) return url;

  const originalUrl = stripImageProcessing(url);
  const preset = options.scene ? SCENE_PRESETS[options.scene] : undefined;
  const opts: ImageProcessOptions = { ...preset, ...options };

  const { width, height, mode = 1, quality, format, interlace, blur } = opts;

  if (!width && !height && quality === undefined && !format && blur === undefined) {
    return originalUrl;
  }

  const segments = [`imageView2/${mode}`];
  if (width) segments.push(`w/${Math.floor(width)}`);
  if (height) segments.push(`h/${Math.floor(height)}`);
  if (quality !== undefined) segments.push(`q/${Math.floor(quality)}`);
  if (format) segments.push(`format/${format}`);
  if (interlace) segments.push('interlace/1');
  if (blur !== undefined) segments.push(`blur/${Math.floor(blur)}`);

  return `${originalUrl}?${segments.join('/')}`;
};

export const resolveImageOptions = (query: ImageQueryParams): ImageProcessOptions | null => {
  if (query.scene) {
    return {
      scene: query.scene,
      width: query.width,
      height: query.height,
      quality: query.quality,
      format: query.format,
    };
  }

  if (query.width || query.height || query.quality !== undefined || query.format) {
    return {
      width: query.width,
      height: query.height,
      quality: query.quality ?? 75,
      format: query.format ?? 'webp',
      mode: query.width && query.height ? 1 : 2,
    };
  }

  return null;
};

export const applyImageProcessingToPhoto = <T extends { url?: string }>(photo: T, options: ImageProcessOptions | null): T & { original_url?: string } => {
  if (!photo?.url) {
    return { ...photo };
  }

  const original_url = stripImageProcessing(photo.url);

  if (!options) {
    return { ...photo, original_url };
  }

  return {
    ...photo,
    original_url,
    url: buildImageUrl(original_url, options),
  };
};

export const applyImageProcessingToPhotos = <T extends { url?: string }>(photos: T[], options: ImageProcessOptions | null): Array<T & { original_url?: string }> => {
  if (!Array.isArray(photos) || photos.length === 0) {
    return photos;
  }

  return photos.map((photo) => applyImageProcessingToPhoto(photo, options));
};

export const applyImageProcessingToCover = <T extends { cover?: string }>(album: T, options: ImageProcessOptions | null): T & { original_cover?: string } => {
  if (!album?.cover) {
    return { ...album };
  }

  const original_cover = stripImageProcessing(album.cover);

  if (!options) {
    return { ...album, original_cover };
  }

  return {
    ...album,
    original_cover,
    cover: buildImageUrl(original_cover, options),
  };
};

/** @deprecated 使用 applyImageProcessingToPhoto */
export const applyImageView2ToPhoto = <T extends { url?: string }>(photo: T, width?: number, height?: number): T => {
  const options = width || height ? { width, height, mode: 1 as const, quality: 75, format: 'webp' as const } : null;
  return applyImageProcessingToPhoto(photo, options);
};

/** @deprecated 使用 applyImageProcessingToPhotos */
export const applyImageView2ToPhotos = <T extends { url?: string }>(photos: T[], width?: number, height?: number): T[] => {
  const options = width || height ? { width, height, mode: 1 as const, quality: 75, format: 'webp' as const } : null;
  return applyImageProcessingToPhotos(photos, options);
};
