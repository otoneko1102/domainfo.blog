import { getAuthBody } from "../../auth.js";
import router from "../../router.js";
import { renderArticleList } from "./listRenderer.js";

export const handleNewArticle = async () => {
  const id = prompt(
    "新しい記事のIDを入力してください (小文字英数、ハイフンのみ)",
  );
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    if (id !== null) alert("無効なIDです。");
    return;
  }
  const title = prompt("記事のタイトルを入力してください");
  if (!title) return;
  try {
    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody({ id, title })),
    });
    if (response.ok) {
      history.pushState(null, "", `/a/${id}`);
      router();
    } else {
      const err = await response.json();
      alert(`記事の作成に失敗しました: ${err.message}`);
    }
  } catch (err) {
    alert("通信エラーが発生しました。");
  }
};

export const handleDeleteArticle = async (id, title) => {
  if (!confirm(`"${title}" を完全に削除しますか？`)) return;
  try {
    const response = await fetch(`/api/articles/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody()),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      await renderArticleList("admin", 1);
    } else {
      alert(`エラー: ${result.message}`);
    }
  } catch (err) {
    alert("記事の削除中にエラーが発生しました。");
  }
};
