/**
 * 格式化日期为 YYYY-MM-DD HH:mm:ss 格式
 * @param date 日期对象或日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化对象中的所有日期字段
 * @param obj 要格式化的对象
 * @param dateFields 需要格式化的日期字段名数组
 * @returns 格式化后的对象
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatObjectDates<T extends Record<string, any>>(
  obj: T,
  dateFields: string[] = ['create_time', 'update_time'],
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = { ...obj } as Record<string, any>;

  for (const field of dateFields) {
    if (result[field] && result[field] instanceof Date) {
      result[field] = formatDate(result[field]);
    }
  }

  return result as T;
}
