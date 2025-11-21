export const buildImageView2Url = (url: string, width?: number, height?: number) => {
  if (!url || (!width && !height)) {
    return url;
  }

  const normalizedWidth = typeof width === 'number' && !isNaN(width) ? Math.floor(width) : undefined;
  const normalizedHeight = typeof height === 'number' && !isNaN(height) ? Math.floor(height) : undefined;

  if (!normalizedWidth && !normalizedHeight) {
    return url;
  }

  const segments = ['imageView2/1'];
  if (normalizedWidth) {
    segments.push(`w/${normalizedWidth}`);
  }
  if (normalizedHeight) {
    segments.push(`h/${normalizedHeight}`);
  }

  const suffix = segments.join('/');
  const connector = url.includes('?') ? '&' : '?';

  return `${url}${connector}${suffix}`;
};

export const applyImageView2ToPhoto = <T extends { url?: string }>(photo: T, width?: number, height?: number): T => {
  if (!photo || !photo.url || (!width && !height)) {
    return photo;
  }

  return {
    ...photo,
    url: buildImageView2Url(photo.url, width, height),
  };
};

export const applyImageView2ToPhotos = <T extends { url?: string }>(photos: T[], width?: number, height?: number): T[] => {
  if (!Array.isArray(photos) || photos.length === 0 || (!width && !height)) {
    return photos;
  }

  return photos.map((photo) => applyImageView2ToPhoto(photo, width, height));
};
