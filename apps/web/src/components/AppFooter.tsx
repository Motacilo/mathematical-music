const PRIVACY_URL = 'https://motacilo.com/privacy.html'

export function AppFooter() {
  return (
    <footer className="app__footer">
      <p>
        作曲の下書き・お気に入り・保存した譜面は、このブラウザ（localStorage）にのみ保存されます。
        アクセス解析のため Google Analytics（GA4）を使用しています。
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          プライバシーポリシー
        </a>
      </p>
    </footer>
  )
}
