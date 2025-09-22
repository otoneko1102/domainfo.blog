// セキュリティ設定（true: sessionStorage, false: localStorage）
export const isStrictSecurity = false;
export const dataStorage = isStrictSecurity ? sessionStorage : localStorage;

// 共通のDOM要素
export const contentArea = document.getElementById("content-area");

// アプリケーションの状態
export let state = {
  keydownHandler: null,
  isSaving: false,
  beforeUnloadHandler: null,
  hasUnsavedChanges: false,
};

// 状態を更新するためのセッター関数
export function setState(newState) {
  state = { ...state, ...newState };
}
