---
id: help.voice.transcription-settings
slug: /help/voice/transcription-settings
title: Voice transcription settings
category: voice
summary: Configure transcription provider and medical specialty to improve accuracy.
audienceRoles: [admin, admin_assistant]
tags: [voice, transcription, settings, aws]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [aws transcribe, medical transcribe, transcription provider]
---

## When to use this

- You want to optimize voice transcription accuracy for your organization's terminology.
- You need to choose between standard and medical transcription services.
- Your organization uses specialized medical vocabulary that should be recognized.

## How it works

Voice transcription converts spoken audio into text that the AI interprets as commands. The accuracy of this transcription affects how well the system understands your voice input.

You can configure two settings:

- **Transcription Provider**: Choose between AWS Medical Transcribe (HIPAA-eligible, optimized for medical terminology) or AWS Standard Transcribe (general purpose).
- **Medical Specialty**: When using AWS Medical Transcribe, specify a medical specialty to improve recognition of specialty-specific terms.

## Steps

### Configure transcription settings

1. Open **Settings** from the sidebar.
2. Find the **Voice Transcription** card.
3. Select a **Transcription Provider**:
   - **AWS Medical Transcribe (HIPAA-eligible)**: Best for healthcare organizations. Optimized for medical terminology and meets HIPAA requirements.
   - **AWS Standard Transcribe**: General-purpose transcription for non-medical use cases.
4. If using AWS Medical Transcribe, select a **Medical Specialty**:
   - Primary Care
   - Cardiology
   - Neurology
   - Oncology
   - Radiology
   - Urology
5. Click **Save Transcription Settings**.

## Available medical specialties

| Specialty | Best for |
| --------- | -------- |
| Primary Care | General healthcare, therapy practices, behavioral health |
| Cardiology | Heart and cardiovascular terminology |
| Neurology | Brain, nervous system, and neurological conditions |
| Oncology | Cancer treatment and related terminology |
| Radiology | Imaging and diagnostic terminology |
| Urology | Urinary system and related terminology |

Choose the specialty closest to your practice area. If none match well, **Primary Care** is a good default for general healthcare settings.

## How this changes with your settings

- **HIPAA requirements**: If your organization handles protected health information (PHI), use AWS Medical Transcribe for HIPAA-eligible transcription.
- **Accuracy**: Medical transcription with the correct specialty improves recognition of specialized terms used in your field.

## Related

- `/help/voice/overview`
- `/help/troubleshooting/voice`

## Troubleshooting

- **Voice commands not recognizing medical terms**: Ensure you're using AWS Medical Transcribe and have selected the appropriate medical specialty.
- **"Voice transcription is not configured"**: Contact your administrator to configure transcription settings.
- **Settings not saving**: Ensure you have administrator permissions. Refresh the page and try again.
