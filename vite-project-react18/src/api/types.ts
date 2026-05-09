declare module 'axios' {
  interface AxiosRequestConfig {
    skipError?: boolean;
  }
}

export interface SpringSort {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface SpringPageable {
  offset: number;
  pageNumber: number;
  pageSize: number;
  paged: boolean;
  sort: SpringSort;
  unpaged: boolean;
}

export interface SpringPage<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  pageable: SpringPageable;
  size: number;
  sort: SpringSort;
  totalElements: number;
  totalPages: number;
}
