import { contentArea } from "../../state.js";

// 418 I'm a teapot!
export const renderTeapotView = () => {
  contentArea.innerHTML = `
    <div class="static-page-container error">
      <h1>418</h1>
      <p style="font-size: 2rem;">🫖 I'm a teapot!</p>
      <p>このサーバーはティーポットなので、コーヒーを入れることはできません。</p>
      <a href="/" class="button">&larr; ホームに戻る</a>
    </div>
  `;
};

// 404 Not Found
export const renderNotFoundView = (error) => {
  contentArea.innerHTML = `
    <div class="static-page-container error">
      <h1>404</h1>
      <p>お探しのページは見つかりませんでした。</p>
      ${error ? `<p style="color: red;">${error}</p>` : ""}
      <a href="/" class="button">&larr; ホームに戻る</a>
    </div>
  `;
};
