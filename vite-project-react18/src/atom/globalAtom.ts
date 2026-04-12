import { atom } from 'jotai';

/**
 * 用于存储当前用户的 Staff ID
 */
export const globalStaffIdAtom = atom<string>('');
