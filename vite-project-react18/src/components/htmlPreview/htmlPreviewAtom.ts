import { atom } from 'jotai';
import type {HtmlShareResponse} from '@/api/conversationHtmlPreviewApi';

// HTML 预览侧边栏显示状态
export const htmlPreviewSidebarVisibleAtom = atom<boolean>(false);

// HTML 预览全屏状态
export const htmlPreviewFullscreenAtom = atom<boolean>(false);


// 轮次ID
export const htmlPreviewTurnIdAtom = atom<string | null>(null);
// 渲染HTML字符串
export const htmlPreviewContentAtom = atom<string | null>(null);
// 本地实时预览模式（开启后不走后端预览接口）
export const htmlPreviewLiveModeAtom = atom<boolean>(false);

export type HtmlShareActionLoading = 'enable' | 'disable' | null;

export interface HtmlShareState {
  actionLoading: HtmlShareActionLoading;
  shareInfo: HtmlShareResponse | null;
}

export const htmlShareStateMapAtom = atom<Record<string, HtmlShareState>>({});

// 显示 HTML 预览侧边栏的 action
export const showHtmlPreviewSidebarAtom = atom(
  null,
  (_get, set) => {
    set(htmlPreviewSidebarVisibleAtom, true);
    set(htmlPreviewFullscreenAtom, false);
  }
);

// 隐藏 HTML 预览侧边栏的 action
export const hideHtmlPreviewSidebarAtom = atom(
  null,
  (_get, set) => {
    set(htmlPreviewSidebarVisibleAtom, false);
    set(htmlPreviewFullscreenAtom, false);
    set(htmlPreviewLiveModeAtom, false);
  }
);

// 切换全屏模式的 action
export const toggleHtmlPreviewFullscreenAtom = atom(
  null,
  (get, set) => {
    const isFullscreen = get(htmlPreviewFullscreenAtom);
    set(htmlPreviewFullscreenAtom, !isFullscreen);
    if (!isFullscreen) {
      set(htmlPreviewSidebarVisibleAtom, true);
    }
  }
);
