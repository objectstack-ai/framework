// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * Español (es-ES) — built-in settings manifest translations.
 */
export const esES: TranslationData = {
  settingsCommon: {
    sourceLabels: {
      env: 'Entorno',
      global: 'Global',
      tenant: 'Inquilino',
      user: 'Usuario',
      default: 'Predeterminado',
    },
  },
  settings: {
    mail: {
      title: 'Envío de correo',
      description: 'Configuración de SMTP y del proveedor de correo transaccional.',
      groups: {
        provider: { title: 'Proveedor', description: 'Elige cómo envía correo saliente este espacio de trabajo.' },
        smtp: { title: 'SMTP' },
        api_key: { title: 'Clave de API' },
        from_address: { title: 'Dirección de remitente' },
      },
      keys: {
        provider: {
          label: 'Proveedor',
          options: {
            smtp: 'SMTP',
            sendgrid: 'SendGrid',
            ses: 'Amazon SES',
            postmark: 'Postmark',
          },
        },
        smtp_host: { label: 'Host', help: 'Ejemplo: smtp.example.com' },
        smtp_port: { label: 'Puerto' },
        smtp_secure: { label: 'Usar TLS' },
        smtp_user: { label: 'Usuario' },
        smtp_password: { label: 'Contraseña' },
        api_key: { label: 'Clave de API' },
        from_email: { label: 'Correo del remitente', help: 'Ejemplo: no-reply@example.com' },
        from_name: { label: 'Nombre del remitente' },
      },
      actions: {
        test: { label: 'Enviar correo de prueba' },
      },
    },

    branding: {
      title: 'Marca',
      description: 'Nombre del espacio de trabajo, logotipo y color de acento.',
      groups: {
        identity: { title: 'Identidad' },
        appearance: { title: 'Apariencia' },
      },
      keys: {
        workspace_name: { label: 'Nombre del espacio de trabajo' },
        support_email: { label: 'Correo de soporte', help: 'Ejemplo: support@example.com' },
        theme_mode: {
          label: 'Tema predeterminado',
          options: { light: 'Claro', dark: 'Oscuro', system: 'Según el sistema' },
        },
        accent_color: { label: 'Color de acento' },
        logo_url: { label: 'URL del logotipo', help: 'Ejemplo: https://…/logo.svg' },
      },
    },

    feature_flags: {
      title: 'Indicadores de función',
      description: 'Activa funciones experimentales y en beta para este espacio de trabajo.',
      groups: {
        productivity: { title: 'Productividad' },
        collaboration: { title: 'Colaboración' },
      },
      keys: {
        ai_enabled: {
          label: 'Asistente de IA',
          help: 'Habilita el panel del asistente de IA dentro de la aplicación.',
        },
        kanban_swimlanes: { label: 'Carriles de Kanban' },
        realtime_cursors: { label: 'Cursores en tiempo real' },
        inline_comments: { label: 'Comentarios en línea' },
      },
    },

    storage: {
      title: 'Almacenamiento de archivos',
      description:
        'Backend usado para adjuntos, exportaciones y subidas de usuarios. ' +
        '⚠ Cambiar de adaptador no migra los archivos existentes: los archivos ' +
        'subidos con el adaptador anterior dejan de ser accesibles a través ' +
        'del nuevo.',
      groups: {
        adapter: { title: 'Backend', description: 'Elige dónde se almacenan los archivos subidos.' },
        local: { title: 'Local' },
        s3: { title: 'S3' },
        limits: { title: 'Límites' },
      },
      keys: {
        adapter: {
          label: 'Adaptador',
          options: { local: 'Sistema de archivos local', s3: 'S3 / compatible con S3' },
        },
        local_root: { label: 'Directorio raíz',
          help: 'Ruta del sistema de archivos donde se almacenan los archivos. Las rutas relativas se resuelven desde el directorio de trabajo del servidor.' },
        s3_bucket: { label: 'Bucket',
          help: 'Bucket compartido del host. Los archivos de cada entorno se aíslan mediante el prefijo projects/<environmentId>/.' },
        s3_region: { label: 'Región', help: 'Ejemplo: us-east-1' },
        s3_endpoint: { label: 'Endpoint',
          help: 'Endpoint personalizado para proveedores compatibles con S3 (R2, MinIO, Wasabi). Déjalo en blanco para AWS S3.' },
        s3_access_key_id: { label: 'Access Key ID' },
        s3_secret_access_key: { label: 'Secret Access Key' },
        s3_force_path_style: { label: 'Forzar URLs de tipo path',
          help: 'Actívalo para MinIO y la mayoría de proveedores compatibles con S3; desactívalo para AWS S3.' },
        presigned_ttl: { label: 'TTL de URL prefirmada (segundos)' },
        session_ttl: { label: 'TTL de sesión de subida (segundos)',
          help: 'Tiempo durante el cual una sesión de subida por fragmentos sigue siendo reanudable.' },
        max_upload_mb: { label: 'Tamaño máximo de subida (MB)' },
      },
      actions: {
        test: { label: 'Probar conexión' },
      },
    },

    ai: {
      title: 'IA y Embedder',
      description:
        'Proveedor de LLM, modelo, credenciales y configuración del embedder usados por ' +
        'los servicios de IA y de conocimiento de la plataforma.',
      groups: {
        provider: { title: 'Proveedor',
          description: 'Elige el backend de LLM. El modo Memory repite la entrada: útil para pruebas, nunca para producción.' },
        gateway: { title: 'Vercel AI Gateway',
          description: 'Enrutador multiproveedor. La especificación del modelo sigue `provider/model`, p. ej. `openai/gpt-4o`.' },
        openai: { title: 'OpenAI' },
        anthropic: { title: 'Anthropic' },
        google: { title: 'Google' },
        defaults: { title: 'Valores predeterminados de generación',
          description: 'Se aplican cuando un agente o una solicitud de chat no especifica su propio valor.' },
        observability: { title: 'Observabilidad' },
        embedder: { title: 'Embedder',
          description:
            'Proveedor de texto → vector usado por las fuentes de conocimiento y RAG. ' +
            'Independiente del proveedor de chat anterior.' },
      },
      keys: {
        provider: {
          label: 'Proveedor',
          options: {
            memory: 'Memory (eco — solo pruebas)',
            gateway: 'Vercel AI Gateway',
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            google: 'Google Generative AI',
          },
        },
        gateway_model: { label: 'Modelo de Gateway',
          help: 'Se reenvía como AI_GATEWAY_MODEL. Ejemplo: openai/gpt-4o' },
        gateway_api_key: { label: 'Clave de API de Gateway',
          help: 'Opcional: solo se requiere si el gateway exige autenticación.' },
        openai_api_key: { label: 'Clave de API de OpenAI',
          help: 'Se reenvía como OPENAI_API_KEY. Se almacena cifrada en reposo.' },
        openai_model: { label: 'Modelo',
          help: 'ID de modelo predeterminado. Las anulaciones por agente tienen prioridad.' },
        openai_base_url: { label: 'Base URL',
          help: 'Anulación para Azure OpenAI o gateways autoalojados. Déjalo en blanco para api.openai.com.' },
        anthropic_api_key: { label: 'Clave de API de Anthropic',
          help: 'Se reenvía como ANTHROPIC_API_KEY. Se almacena cifrada en reposo.' },
        anthropic_model: { label: 'Modelo' },
        google_api_key: { label: 'Clave de API de Google',
          help: 'Se reenvía como GOOGLE_GENERATIVE_AI_API_KEY. Se almacena cifrada en reposo.' },
        google_model: { label: 'Modelo' },
        temperature: { label: 'Temperatura',
          help: '0 = determinista, 2 = muy creativo.' },
        max_tokens: { label: 'Máximo de tokens de salida',
          help: 'Límite estricto de tokens generados por respuesta.' },
        request_timeout_ms: { label: 'Tiempo de espera de la solicitud (ms)' },
        trace_enabled: { label: 'Registrar trazas',
          help: 'Persiste las trazas de prompt/respuesta en sys_ai_trace para depuración y reproducción.' },
        log_prompts: { label: 'Registrar prompts completos',
          help: 'Incluye los prompts renderizados (no solo metadatos) en las filas de traza. ⚠ Puede filtrar PII: desactívalo en entornos regulados.' },
        embedder_provider: {
          label: 'Proveedor',
          options: {
            none: 'Deshabilitado (sin embeddings)',
            openai: 'OpenAI',
            azure: 'Azure OpenAI',
            dashscope: '阿里通义 DashScope',
            zhipu: '智谱 BigModel',
            siliconflow: '硅基流动 SiliconFlow',
            doubao: '火山引擎 Doubao',
            minimax: 'MiniMax',
            ollama: 'Ollama (local)',
            custom: 'Personalizado (compatible con OpenAI)',
          },
        },
        embedder_api_key: { label: 'Clave de API del embedder',
          help: 'Token bearer enviado en la cabecera Authorization. Para Ollama sirve cualquier valor no vacío.' },
        embedder_model: { label: 'Modelo',
          help: 'Ejemplos — OpenAI: text-embedding-3-small · 阿里通义: text-embedding-v3 · 智谱: embedding-3 · 硅基流动: BAAI/bge-m3 · Ollama: bge-m3' },
        embedder_base_url: { label: 'Base URL',
          help: 'Raíz del endpoint (sin /embeddings). Se autocompleta desde el preset; anúlalo para proxys o gateways autoalojados.' },
        embedder_dimensions: { label: 'Dimensiones',
          help: 'Anula la dimensionalidad de salida (solo modelos Matryoshka). Déjalo en blanco para usar el valor predeterminado del modelo.' },
        embedder_batch_size: { label: 'Tamaño de lote',
          help: 'Fragmentos por llamada a embed(). Redúcelo si alcanzas los límites de tasa o tamaño del proveedor.' },
      },
      actions: {
        test: { label: 'Probar conexión' },
        test_embedder: { label: 'Probar embedder' },
      },
    },

    knowledge: {
      title: 'Conocimiento',
      description:
        'Backend de almacén de vectores para RAG / fuentes de conocimiento. ' +
        '⚠ Cambiar de adaptador NO migra los índices existentes.',
      groups: {
        adapter: { title: 'Backend',
          description: 'Elige dónde se almacenan los fragmentos de documento y sus vectores.' },
        turso: { title: 'Turso / libSQL',
          description: 'Funciona con Turso gestionado, archivo local o en memoria.' },
        ragflow: { title: 'RAGFlow',
          description: 'Despliegue externo de RAGFlow. Consulta https://ragflow.io para instrucciones de autoalojamiento.' },
        indexing: { title: 'Valores predeterminados de indexación',
          description: 'Los valores por fuente en KnowledgeSource.adapterConfig tienen prioridad.' },
        permissions: { title: 'Permisos' },
      },
      keys: {
        adapter: {
          label: 'Adaptador',
          options: {
            memory: 'En memoria (solo desarrollo / pruebas)',
            turso: 'Turso / libSQL (nube o local)',
            ragflow: 'RAGFlow (externo)',
          },
        },
        turso_url: { label: 'URL de conexión',
          help: 'Ejemplos: libsql://your-tenant.turso.io · file:./.objectstack/knowledge.db · :memory:' },
        turso_auth_token: { label: 'Token de autenticación',
          help: 'Solo se requiere para URLs de Turso gestionado.' },
        ragflow_base_url: { label: 'Base URL', help: 'Ejemplo: http://localhost:9380' },
        ragflow_api_key: { label: 'Clave de API' },
        ragflow_default_dataset: { label: 'ID de dataset predeterminado',
          help: 'Se usa cuando una KnowledgeSource no especifica su propio dataset de RAGFlow.' },
        chunk_target: { label: 'Tamaño objetivo de fragmento (caracteres)',
          help: 'Límite flexible del tamaño de fragmento antes de que actúe la división consciente de tokens.' },
        chunk_overlap: { label: 'Solapamiento de fragmentos (caracteres)',
          help: 'Caracteres conservados del fragmento anterior para que el contexto sobreviva al límite.' },
        over_fetch: { label: 'Multiplicador de sobre-obtención',
          help: 'Se obtienen topK × overFetch candidatos internos para que el filtrado de metadatos en JS siga teniendo filas.' },
        enforce_rls: { label: 'Aplicar RLS en la búsqueda',
          help: 'Vuelve a comprobar cada resultado contra los permisos a nivel de registro del solicitante. ⚠ Desactivarlo omite la salvaguarda exclusiva de la plataforma.' },
      },
      actions: {
        test: { label: 'Probar conexión' },
      },
    },
  },
};
