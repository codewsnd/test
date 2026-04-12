/**
 * Paginated response structure
 */
interface IPage<T> {
  /** Current page data items */
  content: T[];

  /** Pagination information */
  pageable: Pageable;

  /** Indicates if this is the last page */
  last: boolean;

  /** Total number of pages */
  totalPages: number;

  /** Total number of elements across all pages */
  totalElements: number;

  /** Number of items per page */
  size: number;

  /** Sorting information for current page */
  sort: Sort;

  /** Current page number (0-indexed) */
  number: number;

  /** Indicates if this is the first page */
  first: boolean;

  /** Actual number of elements in current page */
  numberOfElements: number;

  /** Indicates if current page is empty */
  empty: boolean;
}

/**
 * Pagination request parameters
 */
interface Pageable {
  /** Sorting configuration */
  sort: Sort;

  /** Offset position (number of items skipped) */
  offset: number;

  /** Current page number (0-indexed) */
  pageNumber: number;

  /** Number of items per page */
  pageSize: number;

  /** Indicates if pagination is enabled */
  paged: boolean;

  /** Indicates if pagination is disabled */
  unpaged: boolean;
}

/**
 * Sorting configuration
 */
interface Sort {
  /** Indicates if results are sorted */
  sorted: boolean;

  /** Indicates if results are not sorted */
  unsorted: boolean;

  /** Indicates if sort fields are empty */
  empty: boolean;
}

export type Page<T> = Partial<IPage<T>>;

