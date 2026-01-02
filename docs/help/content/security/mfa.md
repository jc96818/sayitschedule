---
id: help.security.mfa
slug: /help/security/mfa
title: MFA setup and account security
category: security
summary: Enable multi-factor authentication (MFA) and keep your account secure.
audienceRoles: [admin, admin_assistant, staff]
tags: [security, mfa, two-factor, authentication]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [2fa, authenticator, two-factor authentication, backup codes]
---

## When to use this

- You want to add extra security to your account.
- Your organization requires MFA for HIPAA compliance.
- You need to set up an authenticator app for the first time.
- You've lost access to your authenticator and need to use backup codes.

## How it works

Multi-factor authentication (MFA) adds a second layer of security to your account. After entering your password, you'll also need to enter a 6-digit code from an authenticator app on your phone.

Some organizations require MFA for all users to meet HIPAA compliance requirements. If MFA is required, you'll be prompted to set it up when you first log in.

## Steps

### Enable MFA (first-time setup)

If your organization requires MFA, you'll see the setup wizard after your first login:

1. Download an authenticator app on your phone:

   - **Google Authenticator** (iOS, Android)
   - **Authy** (iOS, Android)
   - **Microsoft Authenticator** (iOS, Android)

2. Open the authenticator app and scan the QR code shown on screen.
3. If you can't scan the QR code, click **Can't scan?** and enter the secret key manually.
4. Enter the 6-digit code from your authenticator app.
5. Save your backup codes in a secure location.
6. Click **Continue to App**.

### Enable MFA from Account Settings

If MFA isn't required but you want to enable it:

1. Click your name in the top-right corner.
2. Select **Account Settings**.
3. Find the **Two-Factor Authentication (MFA)** section.
4. Click **Enable MFA**.
5. Enter your password to confirm.
6. Scan the QR code with your authenticator app.
7. Enter the 6-digit verification code.
8. Save your backup codes securely.
9. Click **I've Saved My Codes**.

### Log in with MFA

Once MFA is enabled:

1. Enter your email and password as usual.
2. Open your authenticator app.
3. Enter the 6-digit code shown for Say It Schedule.
4. Click **Verify**.

The code changes every 30 seconds, so enter it promptly.

### Use a backup code

If you can't access your authenticator app:

1. On the MFA verification screen, click **Use backup code** (if available).
2. Enter one of your saved backup codes.
3. Click **Verify**.

Each backup code can only be used once. After using a backup code, consider regenerating your codes.

### Regenerate backup codes

If you've used backup codes or want new ones:

1. Go to **Account Settings**.
2. Find the **Two-Factor Authentication** section.
3. Click **Regenerate Backup Codes**.
4. Enter your password to confirm.
5. Save the new codes securely.

This invalidates all previous backup codes.

### Disable MFA

If MFA is optional for your organization:

1. Go to **Account Settings**.
2. Find the **Two-Factor Authentication** section.
3. Click **Disable MFA**.
4. Enter your password to confirm.
5. Click **Disable MFA** to confirm.

If your organization requires MFA, you cannot disable it.

## Backup codes

When you enable MFA, you receive a set of one-time backup codes. These codes let you log in if you lose access to your authenticator app.

**Important guidelines:**

- Each code can only be used once.
- Store codes in a secure location (password manager, printed in a safe place).
- Never share your backup codes with anyone.
- Regenerate codes if you think they've been compromised.
- Keep track of how many codes you have remaining.

## Recommended authenticator apps

| App | Platform | Notes |
| --- | -------- | ----- |
| Google Authenticator | iOS, Android | Simple, reliable, works offline |
| Authy | iOS, Android, Desktop | Cloud backup, multi-device sync |
| Microsoft Authenticator | iOS, Android | Works with Microsoft accounts too |

All three apps are free and support the TOTP standard used by Say It Schedule.

## Related

- `/help/getting-started/roles`
- `/help/security/hipaa-baa`

## Troubleshooting

- **Code not working**: Ensure your phone's time is synchronized automatically. Time drift can cause codes to be rejected.
- **Lost access to authenticator**: Use a backup code to log in, then set up MFA again with a new device.
- **No backup codes left**: Contact your organization's administrator to reset your MFA.
- **QR code won't scan**: Use the manual entry option and type the secret key into your authenticator app.
- **"MFA required" message**: Your organization requires MFA. Complete the setup to continue using the app.
- **Can't disable MFA**: Your organization has made MFA mandatory. Contact your administrator if you have questions.
