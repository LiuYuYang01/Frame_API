/**
 * 分页数据接口
 */
export interface PageData<T> {
  items: T[]; // 数据列表
  total: number; // 总数量
  page: number; // 当前页
  size: number; // 每页数量
}

/**
 * 分页结果接口
 */
export interface PagingResult<T> {
  page: number; // 当前页
  size: number; // 每页数量
  pages: number; // 总页数
  prev: boolean; // 是否还有上一页
  next: boolean; // 是否还有下一页
  total: number; // 总数量
  result: T[]; // 数据
}

/**
 * 分页工具类
 */
export class Paging {
  static filter<T>(data: PageData<T>): PagingResult<T> {
    const pages = Math.ceil(data.total / data.size); // 总页数

    return {
      page: data.page, // 当前页
      size: data.size, // 每页数量
      pages: pages, // 总页数
      prev: data.page > 1, // 是否还有上一页
      next: data.page < pages, // 是否还有下一页
      total: data.total, // 总数量
      result: data.items, // 数据
    };
  }
}
