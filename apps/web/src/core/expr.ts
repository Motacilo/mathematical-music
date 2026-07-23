/**
 * Safe expression evaluator for sequence mode.
 * Supports: n, numbers, + - * / ^ (or **), parentheses, unary minus.
 */

export type ExprResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

type Tok =
  | { t: 'num'; v: number }
  | { t: 'n' }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }

function tokenize(input: string): Tok[] | string {
  const s = input.replace(/\s+/g, '')
  if (!s) return '式が空です'
  const tokens: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (c === 'n' || c === 'N') {
      tokens.push({ t: 'n' })
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ t: 'lp' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ t: 'rp' })
      i++
      continue
    }
    if ('+-*/^'.includes(c)) {
      if (c === '*' && s[i + 1] === '*') {
        tokens.push({ t: 'op', v: '^' })
        i += 2
        continue
      }
      tokens.push({ t: 'op', v: c })
      i++
      continue
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1] ?? ''))) {
      let j = i
      while (j < s.length && /\d/.test(s[j]!)) j++
      if (s[j] === '.') {
        j++
        while (j < s.length && /\d/.test(s[j]!)) j++
      }
      const num = Number(s.slice(i, j))
      if (!Number.isFinite(num)) return '不正な数値です'
      tokens.push({ t: 'num', v: num })
      i = j
      continue
    }
    return `使えない文字です: ${c}`
  }
  return tokens
}

class ParserWithN {
  private i = 0
  private tokens: Tok[]
  private n: number

  constructor(tokens: Tok[], n: number) {
    this.tokens = tokens
    this.n = n
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i]
  }

  private take(): Tok | undefined {
    return this.tokens[this.i++]
  }

  parse(): number {
    const v = this.expr()
    if (this.i < this.tokens.length) throw new Error('式の末尾が不正です')
    if (!Number.isFinite(v)) throw new Error('計算結果が不正です')
    return v
  }

  private expr(): number {
    let v = this.term()
    for (;;) {
      const p = this.peek()
      if (p?.t !== 'op' || (p.v !== '+' && p.v !== '-')) break
      this.take()
      const r = this.term()
      v = p.v === '+' ? v + r : v - r
    }
    return v
  }

  private term(): number {
    let v = this.power()
    for (;;) {
      const p = this.peek()
      if (p?.t !== 'op' || (p.v !== '*' && p.v !== '/')) break
      this.take()
      const r = this.power()
      if (p.v === '*') v *= r
      else {
        if (r === 0) throw new Error('0 で割れません')
        v /= r
      }
    }
    return v
  }

  /** Right-associative exponentiation */
  private power(): number {
    const base = this.unary()
    const p = this.peek()
    if (p?.t === 'op' && p.v === '^') {
      this.take()
      const exp = this.power()
      if (Math.abs(exp) > 20) throw new Error('指数が大きすぎます')
      const v = base ** exp
      if (!Number.isFinite(v)) throw new Error('計算結果が不正です')
      return v
    }
    return base
  }

  private unary(): number {
    const p = this.peek()
    if (p?.t === 'op' && p.v === '-') {
      this.take()
      return -this.unary()
    }
    if (p?.t === 'op' && p.v === '+') {
      this.take()
      return this.unary()
    }
    return this.primary()
  }

  private primary(): number {
    const tok = this.take()
    if (!tok) throw new Error('式が途中で終わっています')
    if (tok.t === 'num') return tok.v
    if (tok.t === 'n') return this.n
    if (tok.t === 'lp') {
      const v = this.expr()
      if (this.take()?.t !== 'rp') throw new Error('括弧が閉じていません')
      return v
    }
    throw new Error('式が不正です')
  }
}

export function looksLikeExpression(text: string): boolean {
  return /[nN]/.test(text) || /[\^*\/()]/.test(text)
}

export function parseNumberList(text: string): number[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
}

export function evaluateExpr(source: string, n: number): ExprResult {
  const tokens = tokenize(source)
  if (typeof tokens === 'string') return { ok: false, error: tokens }
  try {
    const value = new ParserWithN(tokens, n).parse()
    return { ok: true, value }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '式の評価に失敗しました',
    }
  }
}

export function validateExpr(source: string): ExprResult {
  return evaluateExpr(source, 0)
}
