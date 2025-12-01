import { contentArea } from "../../state.js";

export const renderCreditsView = async () => {
  try {
    const response = await fetch("/api/packages");
    if (!response.ok) {
      throw new Error("パッケージ情報の取得に失敗しました。");
    }
    const { dependencies, devDependencies } = await response.json();

    const createPackageList = (packages) => {
      if (!packages || packages.length === 0) {
        return "<li>情報がありません。</li>";
      }
      return packages
        .map(
          (pkg) =>
            `<li><a href="https://www.npmjs.com/package/${pkg}" target="_blank" rel="noopener noreferrer">${pkg}</a></li>`,
        )
        .join("");
    };

    contentArea.innerHTML = `
      <div class="static-page-container">
        <h1>Credits</h1>
        <p>このサイトは、以下の技術や素材を利用して制作されています。</p>

        <section>
          <h2>Dependencies</h2>
          <p>アプリケーションの動作に使用されているライブラリです。</p>
          <ul class="packages-list">
            ${createPackageList(dependencies)}
          </ul>
        </section>

        <section>
          <h2>Dev Dependencies</h2>
          <p>開発環境の構築に使用されているライブラリです。</p>
          <ul class="packages-list">
            ${createPackageList(devDependencies)}
          </ul>
        </section>

        <section>
          <h2>Assets</h2>
          <p>ページ内のボタンのアイコンなどに使用されているアセットです。</p>
          <ul>
            <li><a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer">Material Symbols and Icons - Google Fonts</a></li>
          </ul>
        </section>

        <section>
          <h2>Licenses</h2>
          <p>このプロジェクトで使用されている主なオープンソースライセンスです。</p>
          <ul>
            <li><a href="https://opensource.org/license/MIT" target="_blank" rel="noopener noreferrer">The MIT License</a></li>
            <li><a href="https://opensource.org/license/apache-2-0" target="_blank" rel="noopener noreferrer">Apache License, Version 2.0</a></li>
            <li><a href="https://opensource.org/license/gpl-3-0" target="_blank" rel="noopener noreferrer">GNU General Public License version 3</a></li>
            <li><a href="https://opensource.org/license/BSD-2-Clause" target="_blank" rel="noopener noreferrer">The 2-Clause BSD License</a></li>
          </ul>
        </section>
      </div>
    `;
  } catch (error) {
    console.error("Creditsページの描画に失敗しました:", error);
    contentArea.innerHTML = `
      <div class="static-page-container">
        <h1>Credits</h1>
        <p>クレジット情報の読み込み中にエラーが発生しました。</p>
        <a href="/" class="button">&larr; ホームに戻る</a>
      </div>
    `;
  }
};
