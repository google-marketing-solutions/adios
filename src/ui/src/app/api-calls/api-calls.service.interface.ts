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
import { Observable } from 'rxjs';
export enum IMAGE_STATUS {
  GENERATED = 'Generated',
  VALIDATED = 'Validated',
  UPLOADED = 'Uploaded',
  DISAPPROVED = 'Disapproved',
  BAD_PERFORMANCE = 'Bad performance',
  REJECTED = 'Manually rejected',
}

export interface AdGroup {
  name: string;
  id: string;
  images: Image[];
}

export interface ImageIssue {
  message: string;
  description: string;
}

export interface Image {
  filename: string;
  url: string;
  status: IMAGE_STATUS;
  selected?: boolean;
  issues?: ImageIssue[];
}

export interface ApiCalls {
  getData(): Observable<AdGroup[]>;
  setImageStatus(images: Image[], status: IMAGE_STATUS): Observable<null>;
}
