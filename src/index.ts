/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { menu } from './menu';
import { ImageExtensionService } from './image-extension-service';
import { ImageGenerationService } from './image-generation-service';
import { ImageUploadService } from './image-upload-service';
import { ExperimentsService } from './experiments-service';
import { GeminiValidationService } from './gemini-validation-service';
import { FRONTEND_HELPER } from './frontend-helper';
import { uiHelper } from './ui-helper';
import { CONFIG } from './config';

declare global {
  var ImageGenerationService: {
    manuallyRun: () => void;
    triggeredRun: () => void;
  };
  var ImageUploadService: {
    manuallyRun: () => void;
    triggeredRun: () => void;
  };
  var ImageExtensionService: {
    manuallyRun: () => void;
    triggeredRun: () => void;
  };
  var runExperimentsService: () => void;
  var runGeminiValidationService: () => void;
  var FRONTEND_HELPER: typeof import('./frontend-helper').FRONTEND_HELPER;
  var uiHelper: typeof import('./ui-helper').uiHelper;
  var menu: typeof import('./menu').menu;
}

// Expose services to global scope via wrappers
globalThis.ImageGenerationService = {
  manuallyRun: () => ImageGenerationService.manuallyRun(),
  triggeredRun: () => ImageGenerationService.triggeredRun(),
};

globalThis.ImageUploadService = {
  manuallyRun: () => ImageUploadService.manuallyRun(),
  triggeredRun: () => ImageUploadService.triggeredRun(),
};

globalThis.ImageExtensionService = {
  manuallyRun: () => ImageExtensionService.manuallyRun(),
  triggeredRun: () => ImageExtensionService.triggeredRun(),
};

globalThis.runExperimentsService = () => {
  const experimentsService = new ExperimentsService(CONFIG['Campaign IDs']);
  experimentsService.run();
};

globalThis.runGeminiValidationService = () => {
  const geminiValidationService = new GeminiValidationService();
  geminiValidationService.run();
};

// For helpers that don't have clear entry points or are just objects,
// we can just assign them to globalThis to prevent tree-shaking and expose them if needed.
globalThis.FRONTEND_HELPER = FRONTEND_HELPER;
globalThis.uiHelper = uiHelper;
globalThis.menu = menu;
