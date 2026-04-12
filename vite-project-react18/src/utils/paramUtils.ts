export const buildQueryParams = (params: Record<string, any>): string => {
  const validParams: Record<string, string> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      validParams[key] = value.toString();
    }
  });

  return Object.entries(validParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};
