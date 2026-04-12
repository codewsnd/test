export const capitalizeFirstLetter = (value?: string) =>
  (value?.[0]?.toUpperCase() ?? '') + (value?.slice(1) ?? '')
