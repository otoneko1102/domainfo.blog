// エディタとプレビューペインの高さを同期させる
export const syncPaneHeights = () => {
  const editor = document.getElementById("editor");
  const view = document.getElementById("view");
  if (editor && view) {
    const viewHeight = view.scrollHeight;
    editor.style.minHeight = `${viewHeight}px`;
  }
};
