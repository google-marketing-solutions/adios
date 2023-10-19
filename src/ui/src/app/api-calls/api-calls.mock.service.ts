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
import { Injectable, NgZone } from '@angular/core';
import {
  AdGroup,
  ApiCalls,
  IMAGE_STATUS,
  Image,
} from './api-calls.service.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiCallsService implements ApiCalls {
  constructor(private ngZone: NgZone) {}

  getData(): Observable<AdGroup[]> {
    return new Observable(subscriber => {
      setTimeout(() => {
        this.ngZone.run(() => {
          subscriber.next([
            {
              name: 'My Ad Group',
              id: '123',
              images: [
                {
                  filename: '20230428_11_36_13/img_5_10',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/20230428_11_36_13/img_5_10',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '20230428_11_36_13/img_5_8',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/20230428_11_36_13/img_5_8',
                  status: IMAGE_STATUS.VALIDATED,
                },
                {
                  filename: '20230428_11_36_13/img_5_9',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/20230428_11_36_13/img_5_9',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '20230428_11_40_54/img_2_10',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/20230428_11_40_54/img_2_10',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '2023328111954/img_2_10',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328111954/img_2_10',
                  status: IMAGE_STATUS.VALIDATED,
                },
                {
                  filename: '2023328111954/img_2_11',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328111954/img_2_11',
                  status: IMAGE_STATUS.VALIDATED,
                },
                {
                  filename: '2023328111954/img_2_6',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328111954/img_2_6',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '2023328112648/img_3_6',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328112648/img_3_6',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '2023328112648/img_3_7',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328112648/img_3_7',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '2023328113117/img_4_8',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328113117/img_4_8',
                  status: IMAGE_STATUS.GENERATED,
                },
                {
                  filename: '2023328113117/img_4_9',
                  url: 'https://storage.mtls.cloud.google.com/adios-mvp/2023328113117/img_4_9',
                  status: IMAGE_STATUS.GENERATED,
                },
              ],
            },
          ]);
          subscriber.complete();
        });
      }, 1000);
    });
  }

  setImageStatus(images: Image[], status: IMAGE_STATUS): Observable<null> {
    return new Observable(subscriber => {
      setTimeout(() => {
        this.ngZone.run(() => {
          subscriber.next();
          subscriber.complete();
        });
      }, 2000);
    });
  }
}
