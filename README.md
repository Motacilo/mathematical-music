# Mathematical Music

作曲が苦手な人向けの **メロディ組み立て Web アプリ**（初版）。

1小節フレーズを生成し、譜面に並べて組み合わせ、1音ずつ音高を調整できます。作ったメロディは **MIDI** / **WAV** でダウンロードできます。

## フォルダ構成

```
005_mathematical_music/
├── apps/web/           # Vite + React + TypeScript
├── docs/product/       # 要件メモ
└── README.md
```

## 必要環境

- Node.js 20+
- モダンブラウザ（Chrome / Edge / Firefox など）

## 起動方法

```bash
cd apps/web
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開きます。

ローカルでも GitHub Pages と同じパスで確認する場合:

```bash
npm run build
npm run preview
```

## 公開（GitHub Pages）

- リポジトリ: https://github.com/Motacilo/mathematical-music
- 公開 URL: https://motacilo.com/mathematical-music/ （カスタムドメイン）
- 代替: https://motacilo.github.io/mathematical-music/

`main` への push で GitHub Actions がビルドし、Pages にデプロイします。

## 使い方

1. **モード**を選ぶ（分布 / 数列 / 完全ランダム）
2. キー・スケール・BPM・リズムを設定し **生成**
3. 候補を **聴く** → 気に入ったら **譜面へ**
4. 譜面の音符をクリックし、上げる / 下げるで微調整
5. **譜面を再生** で通し聴き
6. **MIDI** または **WAV** で書き出し

### 生成モード

| モード | 内容 |
|--------|------|
| 分布 | 中心音を中央にした半音棒グラフ（キー外含む）。幅は ±4〜±18半音。プリセットに「完全ランダム」（全音均等）あり |
| 数列 | `n` を含む式（四則・べき乗）またはカンマ列。範囲は音名で指定。キー内ステップ／半音ステップ切替。範囲外はループ |


度数 `1` = トニック（キーの主音）。分布の棒はドラッグで確率変更できます。

## Cubase への取り込み

### MIDI（.mid）— 音符として再編集

1. Cubase でプロジェクトを開く
2. **ファイル → 読み込み → MIDI ファイル**（またはメディアベイからドラッグ）
3. 読み込まれた MIDI パートを開き、ピッチ・リズムを編集

書き出しはメロディ 1 トラック・4/4・指定 BPM です。

### WAV（.wav）— 音声として取り込み

1. Cubase のプロジェクトへ WAV をドラッグ＆ドロップ
2. オーディオイベントとして配置されます（音符編集は不可）

試聴・デモ用途向けです。編集の本命は MIDI を使ってください。

## 技術スタック

- TypeScript / React / Vite
- Tone.js（再生・WAV オフラインレンダ）
- `@tonejs/midi`（MIDI 書き出し）

## 初版の範囲外

- 和音・伴奏・ドラム
- MusicXML
- 本格的な楽譜エディタ
- クラウド保存・ユーザ認証
