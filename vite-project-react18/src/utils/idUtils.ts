import { validate, v7 } from 'uuid';

export const isUUID = (str: string): boolean => {
  if (!str?.trim()) return false;
  return validate(str.trim());
};


export const UUIDV7 = (): string => v7().toString();

