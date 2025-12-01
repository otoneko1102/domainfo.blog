const { isStrictSecurity } = window.APP_CONFIG;
export const dataStorage = isStrictSecurity ? sessionStorage : localStorage;

export const contentArea = document.getElementById("content-area");

export let state = {
  keydownHandler: null,
  isSaving: false,
  beforeUnloadHandler: null,
  hasUnsavedChanges: false,
};

export function setState(newState) {
  state = { ...state, ...newState };
}
