<!--
Copyright 2023 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

<img align="left" width="150" src="assets/images/logo.png" alt="adios logo" /><br />

# Adios: One-stop solution for Google Ads image assets management

[![GitHub last commit](https://img.shields.io/github/last-commit/google-marketing-solutions/adios)](https://github.com/google-marketing-solutions/adios/commits)
![GitHub Release](https://img.shields.io/github/v/release/google-marketing-solutions/adios)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)
[![GitHub License](https://img.shields.io/github/license/google-marketing-solutions/adios)](https://github.com/google-marketing-solutions/adios/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/google-marketing-solutions/adios)](https://github.com/google-marketing-solutions/adios/graphs/contributors)

https://github.com/google-marketing-solutions/adios/assets/3335483/71be79f8-8393-444f-961a-ced8316df6d2

## Overview

**Adios** is the open-source solution that streamlines your image asset management. Effortlessly upload your existing images in bulk and link them directly to relevant ad groups. Don't have images? No problem! **Adios** harnesses the power of AI to generate personalized, high-quality images tailored to your specific ad group context, boosting your campaign's visual appeal and performance.

To generate images Adios uses the recent [Imagen](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview) model on Google Cloud's [Vertex AI](https://cloud.google.com/vertex-ai/) platform.

## Case Study

You can find [Adios case study in German](https://www.thinkwithgoogle.com/intl/de-de/marketing-strategien/automatisierung/tourlane-generative-ki/) (or you can try [Google Translate version](https://www-thinkwithgoogle-com.translate.goog/intl/de-de/marketing-strategien/automatisierung/tourlane-generative-ki/?_x_tr_sl=de&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=in,wapp), just select your preferred language in the top menu).

## The Challenge

Google Ads customers with extensive ad group structures often face challenges in managing image assets effectively. Maintaining high-quality, relevant images for thousands, or even millions, of niche ad groups can be a daunting task. The current Google Ads UI lacks the tools to streamline bulk image uploads and management, making the process time-consuming and inefficient. This can hinder marketers' efforts to personalize image extensions and optimize their campaigns at scale.

## The Approach

In close collaboration with several advertisers, our team developed a custom solution to address these challenges: **Adios**.

## The Solution

Here are some of Adios's powerful features:

- **Generate at scale**: Leverage the power of Generative AI on Google Cloud to create thousands or even millions of images tailored to your ad groups. With minimal code adjustments, you can integrate almost any Generative AI API for unparalleled flexibility.
- **Automate asset management**: Effortlessly upload and manage your image assets in Google Ads, whether you've generated them with Adios or already have them on hand.
- **Optional manual validation**: Ensure optimal quality by manually reviewing generated images before they go live in your campaigns.
- **Seamless A/B testing**: Easily create Google Ads experiments to compare the performance of your new image assets against your existing setup, optimizing click-through rates and campaign success.

## Releases & features
### Adios v1.2

Features:
- [Enhanced Triggers](#enhanced-triggers): Optimized how long-running services operate, addressing execution time limits for large-scale ad group processing. (See Google Apps Script [quotas for details](https://developers.google.com/apps-script/guides/services/quotas#current_limitations)).
- [Google Ads API Mocks](#google-ads-api-mocks): Experiment with Adios features and functionality without needing a Google Ads account.
- Text-to-Image prompt generation has been switched to Gemini 1.5 Flash.
- The Google Ads API has been upgraded to version 17.

### Adios v1.1
https://github.com/google-marketing-solutions/adios/assets/3335483/9be71a1a-43da-49ba-b203-598e797f1d64

Features:
- Automatic, AI ([Gemini](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview)) based image policy validation. Now you can write your brand, company, _you name it_ ads policies as a text and the generated image will be validated against those policies.
- Ad Group names translations. Now you can translate your ad group names (or parts of them) e.g. into better text-to-image prompts.
- Keyword based image generation. Previously you could generate images only based on the ad group names.

### Adios v1.0
Features:
- Generate image assets (ad group level) based on the ad group names
- Image validation UI (validate manually generated images before uploading to Google Ads).
- Upload generated assets to the Google Ads assets library.
- Link uploaded assets to the respective ad groups.
- One click creation of the Google Ads experiments to test performance of the uploaded assets.

Note: these features can be used separately, e.g. you can just upload images to the assets library (if you don't want to generate images, but only to sync your existing assets with your Google Ads account).

## Installation Guide

https://github.com/google-marketing-solutions/adios/assets/3335483/f22172d3-38f1-4fdb-b366-67a33700180e

1. Make a copy of the [template Spreadsheet: Adios v1.2](https://docs.google.com/spreadsheets/d/1DUNphGZIRL6mPDyrqgXErL-7p-gs0WmTqIjZl2ZXdSM/edit?usp=sharing) (in the main menu `File > Make a copy`). Earlier versions:
   - [Adios v1.1](https://docs.google.com/spreadsheets/d/1A0UbhSiF1ox47WUbA4VZ4oh4WlwzbRbkuQHQshHNWiU/edit?usp=sharing&resourcekey=0-283C6nDIyps8TKhcgtxXeQ)
   - [Adios 1.0](https://docs.google.com/spreadsheets/d/1YnFCTif5ruLqs4qJIMcJmvejMEhvFHBzkBwfDp_oWRE/edit?resourcekey=0-mj_eJDv4XRwv2zwOJnYXug)

1. Create or use an existing [Google Cloud Platform](https://console.cloud.google.com/) (GCP) project

   - Ensure that billing is enabled on the project
   - Enable the [Google Ads API](https://console.cloud.google.com/apis/api/googleads.googleapis.com)
   - Enable the [Cloud Storage API](https://console.cloud.google.com/apis/api/storage.googleapis.com)
   - Configure [OAuth consent](https://console.cloud.google.com/apis/credentials/consent) (if you haven't done before for this project)
   - If you would like to generate images, make sure that you have access to the [Vertex AI API](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

1. On the copied Spreadsheet, open Extensions > Apps Script

1. Go to Project Settings and [change the GCP project](https://developers.google.com/apps-script/guides/cloud-platform-projects).
   Learn how to [determine the project **number**](https://developers.google.com/apps-script/guides/cloud-platform-projects#determine_the_id_number_of_a_standard)

1. Fill in the required configuration in the Spreadsheet, as instructed in the comments

1. Now you can run or schedule the Adios services using the Adios menu

## Assets generation
Notes: 
- this step is not required if you already have the assets.
- starting from Adios v1.1 you can generate assets based on ad group keywords (check this [video](https://github.com/google-marketing-solutions/adios/assets/3335483/9be71a1a-43da-49ba-b203-598e797f1d64)).

https://github.com/google-marketing-solutions/adios/assets/3335483/72db55da-7ed1-47bb-8daf-b61d50fb1ea7

## Google Ads API Mocks

Want to try out image generation without real ad groups? Simulate them easily with a spreadsheet:

- __Configure Adios__: In the "Config" sheet, add a variable named "Google Ads Mock Sheet". Choose a name for your mock sheet (e.g., "Mock") and set it as the value for this variable.
- __Create Your Mock Data__: Create a new sheet with the name you chose (e.g., "Mock"). Make sure it has two columns:
  - "Ad Group Name": Enter a name for each simulated ad group.
  - "Keywords": List the keywords associated with each ad group (coma separeted).

Adios will treat this as your ad group data for image generation, and you can find the generated images in your GCS bucket under `<Your Bucket>/Mock/...`.

## Assets upload and linking to Add Groups

https://github.com/google-marketing-solutions/adios/assets/3335483/da5ed888-38c2-49a2-b53d-1b0926b524c2

## Testing performance of the generated assets

Many advertisers want to measure the impact of adding generated assets.
This can be properly done only with an A/B test where the traffic is split between:

- Variant A: generated assets are added on the ad group level
- Variant B: previous ads configuration (most probably one of the following: no image assets at all or image assets added on campaign/account level)

Adios can create such tests for you in the form of
[Google Ads Experiments](https://support.google.com/google-ads/answer/6261395?hl=en) with a click of a button.

### How to implement the experiments

https://github.com/google-marketing-solutions/adios/assets/3335483/3c7820a1-6f2e-41e3-8a77-b3204e97d280

- Step 1: Generate new image assets, upload them to the assets library and link
  them to the ad groups (please check the main menu "Adios > Run > ...")
- Step 2: Create experiments (one for each campaign configured in the `Campaign IDs` of "Config" sheet) by running "Adios > Run > Create experiments"

As a result you will be able to see newly created experiments in the
[Experiments](https://ads.google.com/aw/experiments/all) section of your Google Ads account.

### Keep in mind

1. Please consider the limitations of Google Ads experiments,
   especially remember that you can run only one experiment per campaign simultaneously.
   So if you already have running experiments for the selected campaigns, you won't
   be able to run a new one for those campaigns. You can check running experiments
   [here](https://ads.google.com/aw/experiments/all).

2. If you make changes to your original campaign, those changes won’t be reflected
   on your experiment. Making changes to either your original campaign or experiment
   while your experiment is running may make it harder to interpret your results.

## Using the Validation UI
Adios provides an optional UI for users to check the generated images and approve/reject them before uploading them to the Google Ads account.

https://github.com/google-marketing-solutions/adios/assets/3335483/d3b15133-6f9e-4057-8fd7-b4ac77aff954

You can use it as follows:

1. Ensure that there is a set `Validated DIR` in the configuration Spreadsheet (e.g. `VALIDATED`)

    This is the name for the directory in the GCS bucket, where approved images will be saved. Disapproved images will be saved to the directory specified in `Disapproved DIR`.

1. In the Spreadsheet, open Extensions > Apps Script

1. Click Deploy > Test deployments

1. Open the URL under Web App

You can click the images pending validation (the ones with the yellow status icon) and approve or reject them using the buttons on the top-right.

## Development Guide

If you'd like to make your own changes to the solution or contribute to it, you can run the code as follows:

1. Follow the steps outlined in our [Contributing Guide](CONTRIBUTING)

1. Clone this repository

   ```
   git clone https://github.com/google-marketing-solutions/adios.git
   ```

1. Go to the newly created folder

   ```
   cd adios
   ```

1. Install dependencies

   ```
   npm install
   ```

1. Make a copy of the [template Spreadsheet](https://docs.google.com/spreadsheets/d/1YnFCTif5ruLqs4qJIMcJmvejMEhvFHBzkBwfDp_oWRE/copy?resourcekey=0-mj_eJDv4XRwv2zwOJnYXug)

1. On the copied Spreadsheet, open Extensions > Apps Script

1. Copy the Apps Script ID. For example:

   > script.google.com/[...]/projects/_<SCRIPT_ID>_/edit

1. Enable the Google Apps Script API (if you haven't done it before)
   <https://script.google.com/home/usersettings>

1. Initialize ASIDE

   ```
   npx @google/aside init && rm test/example-module.test.ts
   ```

   - **Don't replace or overwrite any of the files if asked to**

   - When prompted for the Script ID, enter the ID you copied in the previous step

   - (optional) If you would like to have a different environment for development and for production, make another copy of the template Spreadsheet and enter the Apps Script ID when prompted for a Script ID for production environment

1. Build the code

   ```
   npm run build
   ```

1. (optional) Run the UI locally

   It is possible to run the Angular validation UI locally.

   However, the functions which are supposed to run on the Apps Script back-end (`google.script.run`) cannot run locally, so there is a mock service for API calls ([api-calls.mock.service.ts](src/ui/src/app/api-calls/api-calls.mock.service.ts)) which mocks API responses (e.g. from Google Ads API) to test locally.

   Start the UI locally by running:

   ```
   npm run serve-ui
   ```

1. Deploy to Apps Script

   To deploy to the development environment run

   ```
   npm run deploy
   ```

   (optional) To deploy to the production environment run

   ```
   npm run deploy:prod
   ```

## Enhanced Triggers

Advertisers with extensive Google Ads accounts often face challenges when processing large numbers of ad groups. Time constraints, like the [6-minute limit](https://developers.google.com/apps-script/guides/services/quotas#current_limitations) on Apps Script execution, can interrupt these tasks.

Adios v1.2 introduces a new approach for our long-running services (like image generation or upload) to tackle this issue:

- The service begins processing your ad group list.
- One minute before the time limit, it saves its progress and sets a timer to resume in 2 minutes.
- When the timer goes off, a fresh instance of the service picks up right where the previous one left off, ensuring seamless operation.

You can explore the core logic behind this feature in [our source code](src/triggerable.ts).

## Disclaimer

**This is not an official Google product.**
