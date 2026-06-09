// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * 日本語 (ja-JP) — built-in settings manifest translations.
 */
export const jaJP: TranslationData = {
  settingsCommon: {
    sourceLabels: {
      env: '環境変数',
      global: 'グローバル',
      tenant: 'テナント',
      user: 'ユーザー',
      default: 'デフォルト',
    },
  },
  settings: {
    mail: {
      title: 'メール配信',
      description: 'SMTP およびトランザクションメールプロバイダー設定。',
      groups: {
        provider: { title: 'プロバイダー', description: 'このワークスペースの送信方法を選択します。' },
        smtp: { title: 'SMTP' },
        api_key: { title: 'API キー' },
        from_address: { title: '差出人アドレス' },
      },
      keys: {
        provider: {
          label: 'プロバイダー',
          options: {
            smtp: 'SMTP',
            sendgrid: 'SendGrid',
            ses: 'Amazon SES',
            postmark: 'Postmark',
          },
        },
        smtp_host: { label: 'ホスト', help: '例: smtp.example.com' },
        smtp_port: { label: 'ポート' },
        smtp_secure: { label: 'TLS を使用' },
        smtp_user: { label: 'ユーザー名' },
        smtp_password: { label: 'パスワード' },
        api_key: { label: 'API キー' },
        from_email: { label: '差出人アドレス', help: '例: no-reply@example.com' },
        from_name: { label: '差出人名' },
      },
      actions: {
        test: { label: 'テストメール送信' },
      },
    },

    branding: {
      title: 'ブランディング',
      description: 'ワークスペース名・ロゴ・アクセントカラー。',
      groups: {
        identity: { title: 'アイデンティティ' },
        appearance: { title: '外観' },
      },
      keys: {
        workspace_name: { label: 'ワークスペース名' },
        support_email: { label: 'サポートメール', help: '例: support@example.com' },
        theme_mode: {
          label: 'デフォルトテーマ',
          options: { light: 'ライト', dark: 'ダーク', system: 'システムに従う' },
        },
        accent_color: { label: 'アクセントカラー' },
        logo_url: { label: 'ロゴ URL', help: '例: https://…/logo.svg' },
      },
    },

    auth: {
      title: '認証',
      description: 'サインイン、登録、組み込み認証機能の制御。',
      groups: {
        email_password: {
          title: 'メールとパスワード',
          description: 'ローカルのメール/パスワードサインインとセルフサービス登録を制御します。',
        },
        social: {
          title: 'ソーシャルサインイン',
          description:
            '組み込みの Google サインインプロバイダーを設定します。デプロイの環境変数が優先されます。',
        },
      },
      keys: {
        email_password_enabled: { label: 'メール/パスワードログインを有効化' },
        signup_enabled: { label: 'セルフサービス登録を許可' },
        require_email_verification: { label: 'メール確認を必須にする' },
        google_enabled: {
          label: 'Google ログインを有効化',
          help: 'Google Cloud Console の Google OAuth クライアント ID とシークレットが必要です。',
        },
        google_client_id: {
          label: 'Google クライアント ID',
          help: 'Google Cloud Console の OAuth クライアント ID。サーバー側で GOOGLE_CLIENT_ID を設定することもできます。',
        },
        google_client_secret: {
          label: 'Google クライアントシークレット',
          help: '保存時に暗号化されます。サーバー側で GOOGLE_CLIENT_SECRET を設定することもできます。',
        },
      },
    },

    feature_flags: {
      title: '機能フラグ',
      description: 'このワークスペースで実験的・ベータ機能を切替えます。',
      groups: {
        productivity: { title: '生産性' },
        collaboration: { title: 'コラボレーション' },
      },
      keys: {
        ai_enabled: {
          label: 'AI アシスタント',
          help: 'アプリ内 AI アシスタントパネルを有効化します。',
        },
        kanban_swimlanes: { label: 'カンバンのスイムレーン' },
        realtime_cursors: { label: 'リアルタイムカーソル' },
        inline_comments: { label: 'インラインコメント' },
      },
    },

    storage: {
      title: 'ファイルストレージ',
      description:
        '添付ファイル・エクスポート・ユーザーアップロードに使用するバックエンド。' +
        '⚠ アダプターを切替えても既存ファイルは移行されません。以前のアダプターでアップロードされたファイルは新しいアダプターからアクセスできなくなります。',
      groups: {
        adapter: { title: 'バックエンド', description: 'アップロードファイルの保存先を選択します。' },
        local: { title: 'ローカル' },
        s3: { title: 'S3' },
        limits: { title: '制限' },
      },
      keys: {
        adapter: {
          label: 'アダプター',
          options: { local: 'ローカルファイルシステム', s3: 'S3 / S3 互換' },
        },
        local_root: { label: 'ルートディレクトリ',
          help: 'ファイルを保存するファイルシステムパス。相対パスはサーバーの CWD から解決されます。' },
        s3_bucket: { label: 'バケット',
          help: '共有ホストバケット。プロジェクト毎のファイルは projects/<environmentId>/ プレフィックスで分離されます。' },
        s3_region: { label: 'リージョン', help: '例: us-east-1' },
        s3_endpoint: { label: 'エンドポイント',
          help: 'S3 互換プロバイダ (R2, MinIO, Wasabi) のカスタムエンドポイント。AWS S3 の場合は空欄。' },
        s3_access_key_id: { label: 'アクセスキー ID' },
        s3_secret_access_key: { label: 'シークレットアクセスキー' },
        s3_force_path_style: { label: 'パススタイル URL を強制',
          help: 'MinIO や多くの S3 互換プロバイダで有効化。AWS S3 では無効化。' },
        presigned_ttl: { label: '署名付き URL の有効期間 (秒)' },
        session_ttl: { label: 'アップロードセッション TTL (秒)',
          help: 'チャンクアップロードの再開可能期間。' },
        max_upload_mb: { label: '最大アップロードサイズ (MB)' },
      },
      actions: {
        test: { label: '接続テスト' },
      },
    },

    ai: {
      title: 'AI と Embedder',
      description:
        'プラットフォームの AI およびナレッジサービスが使用する LLM プロバイダー、モデル、認証情報、Embedder 設定。',
      groups: {
        provider: { title: 'プロバイダー',
          description: 'LLM バックエンドを選択します。Memory モードは入力をそのまま返します。テスト用であり、本番では使用しないでください。' },
        gateway: { title: 'Vercel AI Gateway',
          description: 'マルチプロバイダールーター。モデル指定は `provider/model` 形式に従います（例: `openai/gpt-4o`）。' },
        openai: { title: 'OpenAI' },
        anthropic: { title: 'Anthropic' },
        google: { title: 'Google' },
        defaults: { title: '生成のデフォルト値',
          description: 'エージェントまたはチャットリクエストが独自の値を指定しない場合に適用されます。' },
        observability: { title: '可観測性' },
        embedder: { title: 'Embedder',
          description:
            'ナレッジソースと RAG が使用するテキスト → ベクトルプロバイダー。' +
            '上記のチャットプロバイダーとは独立しています。' },
      },
      keys: {
        provider: {
          label: 'プロバイダー',
          options: {
            memory: 'Memory（エコー — テスト専用）',
            gateway: 'Vercel AI Gateway',
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            google: 'Google Generative AI',
          },
        },
        gateway_model: { label: 'Gateway モデル',
          help: 'AI_GATEWAY_MODEL として転送されます。例: openai/gpt-4o' },
        gateway_api_key: { label: 'Gateway API キー',
          help: '任意 — Gateway が認証を要求する場合のみ必要です。' },
        openai_api_key: { label: 'OpenAI API キー',
          help: 'OPENAI_API_KEY として転送されます。保存時に暗号化されます。' },
        openai_model: { label: 'モデル',
          help: 'デフォルトのモデル ID。エージェント単位の上書きが優先されます。' },
        openai_base_url: { label: 'Base URL',
          help: 'Azure OpenAI や自己ホスト型ゲートウェイ用の上書き。api.openai.com の場合は空欄にします。' },
        anthropic_api_key: { label: 'Anthropic API キー',
          help: 'ANTHROPIC_API_KEY として転送されます。保存時に暗号化されます。' },
        anthropic_model: { label: 'モデル' },
        google_api_key: { label: 'Google API キー',
          help: 'GOOGLE_GENERATIVE_AI_API_KEY として転送されます。保存時に暗号化されます。' },
        google_model: { label: 'モデル' },
        temperature: { label: 'Temperature',
          help: '0 = 決定的、2 = 非常に創造的。' },
        max_tokens: { label: '最大出力トークン数',
          help: 'レスポンスごとに生成されるトークンの上限。' },
        request_timeout_ms: { label: 'リクエストタイムアウト (ms)' },
        trace_enabled: { label: 'トレースを記録',
          help: 'デバッグと再生のため prompt/response トレースを sys_ai_trace に保存します。' },
        log_prompts: { label: '完全なプロンプトを記録',
          help: 'メタデータだけでなくレンダリングされたプロンプトをトレース行に含めます。⚠ PII が漏えいする可能性があります。規制環境では無効にしてください。' },
        embedder_provider: {
          label: 'プロバイダー',
          options: {
            none: '無効（埋め込みなし）',
            openai: 'OpenAI',
            azure: 'Azure OpenAI',
            dashscope: '阿里通义 DashScope',
            zhipu: '智谱 BigModel',
            siliconflow: '硅基流动 SiliconFlow',
            doubao: '火山引擎 Doubao',
            minimax: 'MiniMax',
            ollama: 'Ollama（ローカル）',
            custom: 'カスタム（OpenAI 互換）',
          },
        },
        embedder_api_key: { label: 'Embedder API キー',
          help: 'Authorization ヘッダーとして送信される Bearer トークン。Ollama では空でない任意の値で動作します。' },
        embedder_model: { label: 'モデル',
          help: '例 — OpenAI: text-embedding-3-small · 阿里通义: text-embedding-v3 · 智谱: embedding-3 · 硅基流动: BAAI/bge-m3 · Ollama: bge-m3' },
        embedder_base_url: { label: 'Base URL',
          help: 'エンドポイントのルート（/embeddings を含まない）。プリセットから自動入力されます。プロキシや自己ホスト型ゲートウェイ用に上書きできます。' },
        embedder_dimensions: { label: '次元数',
          help: '出力次元数を上書きします（Matryoshka モデルのみ）。空欄の場合はモデルのデフォルトを使用します。' },
        embedder_batch_size: { label: 'バッチサイズ',
          help: 'embed() 呼び出しごとのチャンク数。プロバイダーのレート/サイズ制限に達する場合は減らします。' },
      },
      actions: {
        test: { label: '接続テスト' },
        test_embedder: { label: 'Embedder をテスト' },
      },
    },

    knowledge: {
      title: 'ナレッジ',
      description:
        'RAG / ナレッジソース用のベクトルストアバックエンド。' +
        '⚠ アダプターを切替えても既存のインデックスは移行されません。',
      groups: {
        adapter: { title: 'バックエンド',
          description: 'ドキュメントチャンクとそのベクトルの保存先を選択します。' },
        turso: { title: 'Turso / libSQL',
          description: 'マネージド Turso、ローカルファイル、インメモリのいずれでも動作します。' },
        ragflow: { title: 'RAGFlow',
          description: '外部 RAGFlow デプロイ。セルフホストの手順は https://ragflow.io を参照してください。' },
        indexing: { title: 'インデックスのデフォルト値',
          description: 'KnowledgeSource.adapterConfig のソース単位の値が優先されます。' },
        permissions: { title: '権限' },
      },
      keys: {
        adapter: {
          label: 'アダプター',
          options: {
            memory: 'インメモリ（開発/テスト専用）',
            turso: 'Turso / libSQL（クラウドまたはローカル）',
            ragflow: 'RAGFlow（外部）',
          },
        },
        turso_url: { label: '接続 URL',
          help: '例: libsql://your-tenant.turso.io · file:./.objectstack/knowledge.db · :memory:' },
        turso_auth_token: { label: '認証トークン',
          help: 'マネージド Turso URL の場合のみ必要です。' },
        ragflow_base_url: { label: 'Base URL', help: '例: http://localhost:9380' },
        ragflow_api_key: { label: 'API キー' },
        ragflow_default_dataset: { label: 'デフォルトデータセット ID',
          help: 'KnowledgeSource が独自の RAGFlow データセットを指定しない場合に使用されます。' },
        chunk_target: { label: '目標チャンクサイズ（文字数）',
          help: 'トークン単位の分割が行われる前のチャンクサイズのソフト上限。' },
        chunk_overlap: { label: 'チャンクの重なり（文字数）',
          help: '境界を越えてコンテキストを維持するため、前のチャンクから保持する文字数。' },
        over_fetch: { label: 'オーバーフェッチ倍率',
          help: 'JS 側のメタデータフィルタリングでも行が残るよう、内部で topK × overFetch 件の候補を取得します。' },
        enforce_rls: { label: '検索時に RLS を強制',
          help: '各ヒットを呼び出し元のレコードレベル権限に対して再確認します。⚠ 無効化するとプラットフォーム固有のセーフガードがスキップされます。' },
      },
      actions: {
        test: { label: '接続テスト' },
      },
    },
  },
};
