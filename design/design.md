# 社内向けチャットアプリ 設計書

## システム概要

### 目的
社内スタッフが Google アカウントでログインし、Google Gemini AI とテキストチャットができる社内向け Web アプリケーション。

### ターゲットユーザー
- @churadata.okinawa ドメインの Google アカウントを持つ社内スタッフ

### 主な機能
- Google OAuth2 ログイン（@churadata.okinawa ドメインのみ許可）
- テキストチャット（ユーザーが質問 → Gemini が回答）
- 会話履歴はブラウザのメモリ上で管理（ブラウザを閉じると破棄）

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー (ブラウザ)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────┐
│                    Next.js (フロントエンド)                       │
│                      Port: 3000                                  │
│  - ログインページ                                                 │
│  - チャット画面                                                   │
│  - Google OAuth2 クライアント処理 (NextAuth.js)                   │
│  - 会話履歴は React state (メモリ) で管理                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API (HTTP)
                               │ Authorization: Bearer <google id_token>
┌──────────────────────────────▼──────────────────────────────────┐
│                    FastAPI (バックエンド)                         │
│                      Port: 8000                                  │
│  - Google id_token 検証 (JWKS エンドポイント)                     │
│  - hd クレームで churadata.okinawa ドメイン確認                   │
│  - チャットリクエスト処理                                         │
│  - Gemini API 呼び出し (ADC 認証)                                 │
│  - グローバル例外ハンドラ（CORS ヘッダー付き 500 レスポンス保証）   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ ADC (Application Default Credentials)
┌──────────────────────────────▼──────────────────────────────────┐
│                    Google Gemini API                             │
│              (Vertex AI / gemini-2.0-flash-001)                  │
└─────────────────────────────────────────────────────────────────┘

外部サービス:
  Google OAuth2 (accounts.google.com)  ← ログイン認証
  Google JWKS エンドポイント            ← id_token 検証用公開鍵
  Vertex AI / Gemini API               ← AI チャット (us-central1)

※ DB は不要（チャット履歴を永続化しないため）
```

---

## Google ログイン（OAuth2）認証フロー

### フロー概要

```
ユーザー          Next.js (NextAuth)         Google OAuth2          FastAPI
   │                    │                         │                    │
   │── ログインボタン ──>│                         │                    │
   │                    │── 認証リクエスト ───────>│                    │
   │                    │                         │                    │
   │<── Google ログイン画面をリダイレクト ─────────│                    │
   │                    │                         │                    │
   │── Google 認証情報入力 ─────────────────────>│                    │
   │                    │                         │                    │
   │                    │<── id_token / profile ──│                    │
   │                    │                         │                    │
   │              [ドメイン検証]                   │                    │
   │              email が @churadata.okinawa     │                    │
   │              であるか確認 (signIn callback)   │                    │
   │              → 違う場合は 403 エラー          │                    │
   │                    │                         │                    │
   │              [id_token をセッションに保持]    │                    │
   │<── セッション Cookie 発行 ───────────────────│                    │
   │                    │                         │                    │
   │── チャットリクエスト ──────────────────────────────────────────>│
   │   Authorization: Bearer <google id_token>                        │
   │                    │                         │  [id_token 検証]  │
   │                    │                         │  JWKS で署名検証   │
   │                    │                         │  hd クレーム確認   │
   │<─────────────────────────────────────────── Gemini 応答 ────────│
```

### ドメイン制限の実装方針

**フロントエンド（NextAuth.js v5）**: `callbacks.signIn` フックでメールアドレスのドメインを検証する。`callbacks.jwt` で Google の `id_token` をスプレッド形式でトークンに保持し、API リクエスト時に使用できるようにする。

```typescript
// NextAuth 設定 (概要) — NextAuth v5 対応実装
callbacks: {
  async signIn({ account, profile }) {
    const email = profile?.email ?? "";
    if (!email.endsWith("@churadata.okinawa")) {
      return false; // ログイン拒否
    }
    return true;
  },
  async jwt({ token, account }) {
    // Google の id_token をスプレッド形式でトークンに保持
    // ※ NextAuth v5 では declare module "next-auth/jwt" による型拡張は使用不可
    if (account?.id_token) {
      return { ...token, id_token: account.id_token };
    }
    return token;
  },
  async session({ session, token }) {
    // 型アサーションで id_token をセッションに公開
    session.id_token = (token as { id_token?: string }).id_token;
    return session;
  }
}
```

> **NextAuth v5 の注意事項**:
> - `declare module "next-auth/jwt"` はモジュールが存在しないためコンパイルエラーになる（削除が必要）
> - JWT トークンへの `id_token` 追加は `return { ...token, id_token: account.id_token }` のスプレッド形式で行う
> - Session への `id_token` 追加は `declare module "next-auth"` 内で `interface Session { id_token?: string }` として型拡張する
> - `session` コールバックでは `(token as { id_token?: string }).id_token` の型アサーションを使用する
> - `trustHost` はコードに書かず、環境変数 `AUTH_TRUST_HOST=true` で制御する

**バックエンド（FastAPI）**: フロントから送られた Google の `id_token` を Google の JWKS エンドポイント (`https://www.googleapis.com/oauth2/v3/certs`) で署名検証し、`hd` クレームが `churadata.okinawa` であることを確認する。NextAuth 独自の JWT は FastAPI 側では使用しない。

```python
# FastAPI 側の検証ロジック (概要)
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

def verify_google_id_token(token: str) -> dict:
    idinfo = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.google_client_id
    )
    # hd クレームでホスト型ドメインを確認
    if idinfo.get("hd") != "churadata.okinawa":
        raise HTTPException(status_code=403, detail="Forbidden domain")
    return idinfo
```

### セッション管理
- NextAuth.js が JWT セッションを管理（Cookie に HttpOnly で保存）
- FastAPI へのリクエスト時はフロントが Google の `id_token` を `Authorization: Bearer <id_token>` ヘッダーに付与
- NextAuth 独自のトークンは FastAPI 側では検証しない

---

## Gemini API との連携方法（ADC 認証）

### ADC（Application Default Credentials）の仕組み

API キーを使用せず、Google の標準認証機構 ADC を利用する。

```
ローカル開発環境:
  gcloud auth application-default login
  → ~/.config/gcloud/application_default_credentials.json が生成される
  → ファイル単体を Docker コンテナにマウントして利用

本番環境 (Cloud Run 等):
  サービスアカウントのロールが自動的に適用される
```

### Docker での ADC 設定

`~/.config/gcloud` ディレクトリ全体ではなく、認証情報ファイル単体のみをマウントする（確定）。

```yaml
# docker-compose.yml (バックエンド抜粋)
backend:
  volumes:
    - ~/.config/gcloud/application_default_credentials.json:/tmp/adc/application_default_credentials.json:ro
  environment:
    - GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
    - GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc/application_default_credentials.json
```

### Gemini API 呼び出し（Python / FastAPI）

```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project=settings.gcp_project, location="us-central1")
model = GenerativeModel("gemini-2.0-flash-001")  # Vertex AI us-central1 で動作確認済み
response = model.generate_content(prompt)
```

ADC が自動的に認証情報を解決するため、コード内に API キーや秘密情報は不要。

---

## CORS と例外処理

### Starlette ServerErrorMiddleware の問題

Starlette の `ServerErrorMiddleware` は 500 エラーを CORS ミドルウェアをバイパスして送信する設計上の問題がある。これにより、未ハンドル例外が発生した場合にブラウザが CORS エラーとして受け取る可能性がある。

### 対処方法

FastAPI のグローバル例外ハンドラ（`@app.exception_handler(Exception)`）を追加することで対処する。

```python
# main.py (概要)
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
```

これにより、未ハンドル例外でも CORS ヘッダー付きの 500 レスポンスが返る。

---

## API 設計

### ベース URL
- ローカル開発: `http://localhost:8000`
- プレフィックス: `/api/v1`

### エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/v1/health` | ヘルスチェック | 不要 |
| POST | `/api/v1/chat/message` | チャットメッセージ送信・Gemini 応答取得 | 必要 |
| GET | `/api/v1/users/me` | ログインユーザー情報取得 | 必要 |

※ チャット履歴はブラウザのメモリで管理するため、履歴取得・削除 API は存在しない。

### リクエスト / レスポンス スキーマ

#### POST /api/v1/chat/message

リクエスト:
```json
{
  "message": "string",        // ユーザーのメッセージ (必須)
  "history": [                // 直前までの会話履歴 (ブラウザから送信)
    {
      "role": "user | assistant",
      "content": "string"
    }
  ]
}
```

レスポンス:
```json
{
  "reply": "string",       // Gemini の応答テキスト
  "created_at": "string"   // ISO8601 形式の日時
}
```

#### GET /api/v1/users/me

レスポンス:
```json
{
  "email": "string",
  "name": "string",
  "picture": "string"
}
```

### 認証方式
- フロントエンドが NextAuth.js のセッションから Google の `id_token` を取得し `Authorization: Bearer <id_token>` に付与
- FastAPI の依存性注入 (`Depends`) で Google JWKS エンドポイントを使って `id_token` を検証
- `hd` クレームが `churadata.okinawa` であることを確認
- 不正な場合は HTTP 401 または 403 を返す

### エラーレスポンス

```json
{
  "detail": "string"  // エラーメッセージ
}
```

| ステータスコード | 説明 |
|-----------------|------|
| 401 | 未認証（トークンなし・無効） |
| 403 | 許可されていないドメインのアカウント |
| 422 | バリデーションエラー |
| 500 | サーバー内部エラー（CORS ヘッダー付きで返却） |

---

## フロントエンド設計

### ページ構成とルーティング

| ルート | ページ名 | 説明 | 認証 |
|--------|---------|------|------|
| `/` | ホーム（リダイレクト） | ログイン済み → `/chat`、未ログイン → `/login` | - |
| `/login` | ログインページ | Google ログインボタン表示 | 不要 |
| `/chat` | チャットページ | メインのチャット画面 | 必要 |
| `/api/auth/[...nextauth]` | NextAuth ハンドラ | OAuth コールバック処理 | - |

### 主要コンポーネント

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx              # ログインページ
├── (main)/
│   └── chat/
│       ├── page.tsx              # チャットページ
│       └── layout.tsx            # チャット用レイアウト
└── api/
    └── auth/
        └── [...nextauth]/
            └── route.ts          # NextAuth ルートハンドラ

components/
├── auth/
│   └── LoginButton.tsx           # Google ログインボタン
├── chat/
│   ├── ChatContainer.tsx         # チャット全体コンテナ
│   ├── MessageList.tsx           # メッセージ一覧表示
│   ├── MessageBubble.tsx         # 個別メッセージ表示 (user / ai)
│   └── ChatInput.tsx             # 入力欄・送信ボタン
└── common/
    ├── Header.tsx                # ヘッダー（ユーザー情報・ログアウト）
    └── LoadingSpinner.tsx        # ローディング表示
```

※ `SessionSidebar.tsx` はチャット履歴を永続化しないため不要。

### 状態管理方針

- **会話履歴**: `React useState` でブラウザのメモリ上のみに保持。ブラウザを閉じると破棄される。
- **API 通信状態（ローディング・エラー）**: `React useState / useReducer` で管理
- **認証状態**: `NextAuth.js` の `useSession()` フック

### 主な状態

```typescript
// チャット画面の状態
type Message = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type ChatState = {
  messages: Message[];  // ブラウザのメモリ上にのみ存在（永続化なし）
  isLoading: boolean;
  inputText: string;
};
```

### チャット送信フロー

```
ユーザーがメッセージ送信
  → messages state に user メッセージを追記
  → 現在の messages 全体を history として POST /api/v1/chat/message に送信
      Authorization: Bearer <session.id_token>  ← Google の id_token
  → Gemini 応答を受信
  → messages state に assistant メッセージを追記
```

### UI/UX 方針
- レスポンシブデザイン対応（スマートフォン・タブレット・PC）
- Gemini 応答中はストリーミング風のローディング表示
- エラー時はトースト通知でユーザーに伝達
- ダークモード対応（Tailwind CSS の `dark:` クラス利用）

---

## データモデル設計

チャット履歴を永続化しない設計のため、DB は不要。会話履歴はブラウザの React state のみで管理し、ページを閉じると破棄される。

アプリケーション内部で使用する型定義のみを示す。

### フロントエンド型定義

```typescript
// types/index.ts

type Message = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type User = {
  email: string;
  name: string;
  picture?: string;
};
```

### バックエンド Pydantic スキーマ

```python
# schemas/chat.py

class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[HistoryItem] = []

class ChatResponse(BaseModel):
    reply: str
    created_at: str
```

---

## ディレクトリ構造

```
workspace/implementation/
├── docker-compose.yml             # 全サービス起動定義
├── .env.example                   # 環境変数サンプル
│
├── frontend/                      # Next.js アプリケーション
│   ├── Dockerfile                 # npm install を使用 (package-lock.json 不在に対応)
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── (auth)/
│       │   │   └── login/
│       │   │       └── page.tsx
│       │   ├── (main)/
│       │   │   └── chat/
│       │   │       ├── page.tsx
│       │   │       └── layout.tsx
│       │   └── api/
│       │       └── auth/
│       │           └── [...nextauth]/
│       │               └── route.ts
│       ├── components/
│       │   ├── auth/
│       │   │   └── LoginButton.tsx
│       │   ├── chat/
│       │   │   ├── ChatContainer.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   └── ChatInput.tsx
│       │   └── common/
│       │       ├── Header.tsx
│       │       └── LoadingSpinner.tsx
│       ├── lib/
│       │   ├── auth.ts            # NextAuth 設定 (v5 対応・id_token をセッションに保持)
│       │   └── api.ts             # バックエンド API クライアント
│       ├── hooks/
│       │   └── useChat.ts         # チャット用カスタムフック
│       └── types/
│           └── index.ts           # 型定義
│
└── backend/                       # FastAPI アプリケーション
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py                # FastAPI エントリーポイント (グローバル例外ハンドラ含む)
        ├── core/
        │   ├── config.py          # 設定（環境変数）
        │   └── auth.py            # Google id_token 検証・hd クレーム確認
        ├── api/
        │   └── v1/
        │       ├── router.py      # ルーター集約
        │       ├── chat.py        # チャット エンドポイント
        │       └── users.py       # ユーザー エンドポイント
        ├── services/
        │   └── gemini.py          # Gemini API 連携 (ADC 認証・gemini-2.0-flash-001)
        └── schemas/
            ├── chat.py            # チャット Pydantic スキーマ
            └── users.py           # ユーザー Pydantic スキーマ

※ DB 関連ディレクトリ (models/, db/) は不要のため削除
```

---

## 技術スタック

### フロントエンド

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Next.js | 15.x | React フレームワーク（App Router） |
| React | 19.x | UI ライブラリ |
| TypeScript | 5.x | 型安全な JavaScript |
| NextAuth.js | 5.x (Auth.js) | Google OAuth2 認証・id_token セッション管理 |
| Tailwind CSS | 4.x | ユーティリティ CSS |
| Axios | 1.x | HTTP クライアント |

※ TanStack Query はサーバー状態管理（DB キャッシュ）用途のため不要。

### バックエンド

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Python | 3.12.x | 実行環境 |
| FastAPI | 0.115.x | Web フレームワーク |
| Uvicorn | 0.34.x | ASGI サーバー |
| google-cloud-aiplatform | 1.x | Vertex AI / Gemini API (ADC 対応) |
| google-auth | 2.x | Google id_token 検証 (JWKS) |
| pydantic-settings | 2.x | 環境変数管理 |

※ SQLAlchemy / Alembic / asyncpg / PyJWT / python-jose は DB・独自 JWT 不要のため削除。

### インフラ（ローカル開発）

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Docker | 27.x 以上 | コンテナ実行環境 |
| Docker Compose | 2.x | マルチコンテナ管理 |

※ PostgreSQL は不要のため構成から除外。

### Google Cloud

| サービス | 用途 |
|---------|------|
| Google OAuth2 | ユーザー認証（@churadata.okinawa ドメイン制限） |
| Google JWKS エンドポイント | id_token 署名検証 |
| Vertex AI / Gemini API | AI チャット（ADC 認証・gemini-2.0-flash-001・us-central1） |
| Application Default Credentials (ADC) | ローカル〜本番共通の認証方式 |

---

## ローカル開発環境のセットアップ手順（概要）

1. Google Cloud Console で OAuth2 クライアント ID を作成
   - 承認済みリダイレクト URI: `http://localhost:3000/api/auth/callback/google`
2. `gcloud auth application-default login` を実行して ADC 認証情報を生成
3. `.env.example` をコピーして `.env` を作成し、各値を設定
4. `docker-compose up --build` でコンテナを起動
5. `http://localhost:3000` にアクセスしてログイン確認

### 必要な環境変数

```env
# Google OAuth2
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx

# NextAuth (v5)
# AUTH_SECRET: openssl rand -base64 32 で生成
AUTH_SECRET=xxxx

# NEXTAUTH_URL: NextAuth v5 では AUTH_URL が正式名だが、NEXTAUTH_URL も後方互換として動作する
NEXTAUTH_URL=http://localhost:3000

# ローカル開発・Docker 環境: AUTH_TRUST_HOST=true を設定（AUTH_URL の代わり）
# 本番環境: AUTH_TRUST_HOST を削除し、AUTH_URL=https://your-domain.com を設定
AUTH_TRUST_HOST=true

# GCP
# プロジェクト名: pray-ground
GOOGLE_CLOUD_PROJECT=pray-ground

# ADC 認証情報パス (Docker コンテナ内)
GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc/application_default_credentials.json
```

### backend/.env.example のモデル名設定

```env
# Gemini モデル名（Vertex AI）
GEMINI_MODEL=gemini-2.0-flash-001
```

### backend/app/core/config.py のデフォルト値

```python
class Settings(BaseSettings):
    # ...
    gemini_model: str = "gemini-2.0-flash-001"  # Vertex AI us-central1 で動作確認済み
    # ...
```

---

## セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| ドメイン制限 | NextAuth の `signIn` コールバック + FastAPI の `hd` クレーム検証で二重チェック |
| トークン検証 | FastAPI は Google JWKS で id_token の署名を検証（NextAuth 独自 JWT は使用しない） |
| API 秘密情報 | ADC を使用し API キーをコードに含めない |
| ADC マウント最小化 | `~/.config/gcloud/application_default_credentials.json` 単体ファイルのみマウント（確定） |
| CORS | FastAPI で `ALLOWED_ORIGINS` を設定し、フロントエンドオリジンのみ許可 |
| CORS + 500 エラー | グローバル例外ハンドラで Starlette の CORS バイパス問題を回避 |
| XSS | Next.js のデフォルト HTML エスケープ + HttpOnly Cookie |
| CSRF | NextAuth.js の CSRF トークン機能を利用 |
| データ保護 | チャット履歴をサーバーに保存しないため、情報漏洩リスクを低減 |
| trustHost | コードに書かず環境変数 `AUTH_TRUST_HOST=true` で制御。本番では `AUTH_URL` を設定 |
