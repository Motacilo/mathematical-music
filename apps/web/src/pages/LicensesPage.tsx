import { Link } from 'react-router-dom'
import './LicensesPage.css'

const OFL = 'https://scripts.sil.org/OFL'

export default function LicensesPage() {
  return (
    <main className="licenses">
      <p>
        <Link to="/layer/start">ホームへ戻る</Link>
      </p>
      <h1>ライセンス</h1>
      <p>このアプリが読み込んでいるフォントと、同梱しているライブラリです。</p>

      <section>
        <h2>フォント</h2>
        <p>SIL Open Font License 1.1。Google Fonts から読み込んでいます。</p>
        <ul>
          <li>
            <strong>IBM Plex Sans</strong>
            <span>Copyright © 2017 IBM Corp. with Reserved Font Name “Plex”.</span>
          </li>
          <li>
            <strong>IBM Plex Sans JP</strong>
            <span>Copyright © 2017 IBM Corp. with Reserved Font Name “Plex”.</span>
          </li>
        </ul>
        <p>
          <a href={OFL}>ライセンス原文</a>
        </p>
      </section>

      <section>
        <h2>ライブラリ</h2>
        <p>MIT License</p>
        <ul>
          <li>
            <strong>React、React DOM</strong>
            <span>Copyright (c) Meta Platforms, Inc. and affiliates.</span>
          </li>
          <li>
            <strong>React Router</strong>
            <span>
              Copyright (c) React Training LLC 2015-2019. Copyright (c) Remix Software Inc.
              2020-2021. Copyright (c) Shopify Inc. 2022-2023.
            </span>
          </li>
          <li>
            <strong>Tone.js</strong>
            <span>Copyright (c) 2014-2020 Yotam Mann.</span>
          </li>
          <li>
            <strong>@tonejs/midi</strong>
            <span>Copyright © 2016 Yotam Mann.</span>
          </li>
        </ul>
        <p>
          Permission is hereby granted, free of charge, to any person obtaining a copy of this
          software and associated documentation files (the “Software”), to deal in the Software
          without restriction, including without limitation the rights to use, copy, modify, merge,
          publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
          to whom the Software is furnished to do so, subject to the following conditions:
        </p>
        <p>
          The above copyright notice and this permission notice shall be included in all copies or
          substantial portions of the Software.
        </p>
      </section>
    </main>
  )
}
