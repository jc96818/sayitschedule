---
id: help.troubleshooting.voice
slug: /help/troubleshooting/voice
title: Voice troubleshooting
category: troubleshooting
summary: Common fixes for voice input and transcription issues.
audienceRoles: [admin, admin_assistant]
tags: [voice, troubleshooting, microphone, transcription]
prerequisites:
  features: [voiceCommandsEnabled]
  settings: []
  org: []
aliases: [microphone, transcription errors, voice not working, cant hear]
---

## When to use this

- Voice input isn't working or responding to your speech.
- You see error messages when trying to use voice commands.
- The transcription is inaccurate or not capturing your words.
- You want to switch between voice and text input.

## Common error messages

### "Microphone access denied"

Your browser is blocking microphone access. To fix:

1. Click the lock or site settings icon in your browser's address bar.
2. Find **Microphone** in the permissions list.
3. Change it to **Allow**.
4. Refresh the page.
5. Try the voice input again.

If you previously denied microphone access, you may need to clear the setting:

- **Chrome**: Settings → Privacy and security → Site settings → Microphone
- **Firefox**: Settings → Privacy & Security → Permissions → Microphone
- **Safari**: Preferences → Websites → Microphone
- **Edge**: Settings → Cookies and site permissions → Microphone

### "Voice transcription is not configured"

The transcription service isn't set up for your organization. An administrator needs to configure transcription settings:

1. Open **Settings** from the sidebar.
2. Find the **Voice Transcription** section.
3. Select a transcription provider.
4. Click **Save**.

### "Session expired. Please log in again."

Your session has timed out. Refresh the page and log in again to continue using voice input.

### "Connection error. Please try again."

The connection to the transcription service was interrupted. This can happen due to:

- Unstable internet connection
- Network timeout
- Server maintenance

Try these steps:

1. Check your internet connection.
2. Wait a few seconds and try again.
3. Refresh the page if the problem continues.

### "You do not have permission to use voice input."

Your user role may not have access to voice commands. Contact your administrator to check your permissions.

### "Session timed out. Please try again."

Voice recording sessions have a time limit. If you paused for too long or the session was idle, it will close automatically. Click the microphone button to start a new session.

## Improving transcription accuracy

### Speak clearly and at a moderate pace

The transcription service works best when you:

- Speak at a natural, conversational pace
- Pronounce words clearly
- Pause briefly between sentences
- Avoid speaking too quickly

### Reduce background noise

Background noise can interfere with transcription:

- Use voice input in a quiet environment
- Close windows to reduce outside noise
- Mute notifications and other audio sources
- Consider using a headset with a microphone

### Check microphone quality

Poor audio quality reduces accuracy:

- Ensure your microphone is working properly
- Position the microphone close to your mouth (if using a headset)
- Test your microphone in your computer's sound settings
- Try a different microphone if available

### Use the correct transcription provider

For medical or healthcare organizations, AWS Medical Transcribe provides better recognition of clinical terminology:

1. Open **Settings**.
2. Find **Voice Transcription**.
3. Select **AWS Medical Transcribe (HIPAA-eligible)**.
4. Choose the appropriate **Medical Specialty**.
5. Click **Save**.

## Using text input instead

If voice input isn't working, you can switch to text input:

1. Look for the **Speak/Type** toggle at the top of the voice input panel.
2. Click **Type** to switch to text mode.
3. Type your command in the text box.
4. Press **Enter** or click **Send**.

The system automatically switches to text mode when:

- Microphone access is denied
- Voice transcription isn't configured
- You don't have permission for voice input

Your preference is remembered, so you won't need to switch again unless you want to.

## Steps to test voice input

1. Open any page with voice input (Staff, Patients, Rooms, Rules, or Schedule).
2. Click the microphone button.
3. Wait for the status to show "Listening..."
4. Say a simple command like "Show all staff."
5. Click the microphone button again to stop recording.
6. Watch for the transcription to appear in the "Heard" section.

If the transcription appears but the command isn't understood, try rephrasing using the examples in the voice hints.

## Related

- [/help/voice/overview](/help/voice/overview)
- [/help/voice/transcription-settings](/help/voice/transcription-settings)

## Troubleshooting

- **Microphone button not appearing**: Voice input may be disabled for your organization. Check with your administrator.
- **"Connecting..." never changes**: Check your internet connection. The transcription service requires a stable connection.
- **Words are being cut off**: Make sure you're not stopping the recording too quickly after speaking. Wait a moment before clicking stop.
- **Commands not being recognized**: The transcription may be accurate, but the command format isn't recognized. Click "View command examples" to see the expected format.
- **Voice works but nothing happens**: The transcription service is working, but the AI may not understand the request. Try rephrasing or use the text input to type your command.
