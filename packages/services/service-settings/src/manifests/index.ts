// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/** Reference manifests bundled with service-settings. */
export { authSettingsManifest } from './auth.manifest.js';
export { mailSettingsManifest, mailTestActionHandler } from './mail.manifest.js';
export { brandingSettingsManifest } from './branding.manifest.js';
export { featureFlagsSettingsManifest } from './feature-flags.manifest.js';
export { storageSettingsManifest, storageTestActionHandler } from './storage.manifest.js';
export {
  aiSettingsManifest,
  aiTestActionHandler,
  aiTestEmbedderActionHandler,
} from './ai.manifest.js';
export { knowledgeSettingsManifest, knowledgeTestActionHandler } from './knowledge.manifest.js';
export { localizationSettingsManifest } from './localization.manifest.js';
export { companySettingsManifest } from './company.manifest.js';

import { authSettingsManifest } from './auth.manifest.js';
import { mailSettingsManifest } from './mail.manifest.js';
import { brandingSettingsManifest } from './branding.manifest.js';
import { featureFlagsSettingsManifest } from './feature-flags.manifest.js';
import { storageSettingsManifest } from './storage.manifest.js';
import { aiSettingsManifest } from './ai.manifest.js';
import { knowledgeSettingsManifest } from './knowledge.manifest.js';
import { localizationSettingsManifest } from './localization.manifest.js';
import { companySettingsManifest } from './company.manifest.js';

/** Convenience aggregate — pass to `SettingsServicePlugin({ manifests })`. */
export const builtinSettingsManifests = [
  brandingSettingsManifest,
  companySettingsManifest,
  localizationSettingsManifest,
  authSettingsManifest,
  mailSettingsManifest,
  storageSettingsManifest,
  aiSettingsManifest,
  knowledgeSettingsManifest,
  featureFlagsSettingsManifest,
];
