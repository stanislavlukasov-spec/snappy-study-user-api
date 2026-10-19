// Email service using AWS SES v3 SDK
//
// Fire-and-forget pattern: callers should not await sendWelcomeEmail if they
// don't want to delay the HTTP response. Errors are logged but never rethrown
// so a SES hiccup never breaks registration.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

/** Escape user-supplied strings before embedding them in HTML email bodies. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

let sesClient = null;
function getClient() {
  if (!sesClient) {
    sesClient = new SESClient({ region: process.env.AWS_REGION || 'eu-central-1' });
  }
  return sesClient;
}

const SENDER = process.env.SENDER_EMAIL || 'noreply@snappystudy.com';

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

function buildWelcomeHtml(displayName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Snappy Study</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.85); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 32px; }
    .step { display: flex; align-items: flex-start; margin-bottom: 24px; }
    .step-number { flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #6c63ff, #48cae4); color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 16px; margin-top: 2px; }
    .step-content h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #1a1a2e; }
    .step-content p { margin: 0; font-size: 14px; line-height: 1.6; color: #555; }
    .divider { border: none; border-top: 1px solid #eee; margin: 32px 0; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📚 Snappy Study</h1>
      <p>Learning made fun for the whole family</p>
    </div>

    <div class="body">
      <p class="greeting">Welcome, ${escapeHtml(displayName)}! 🎉</p>
      <p class="intro">
        You're all set! Snappy Study helps your children learn by turning everyday objects and images into interactive study sessions. Here's how to get started:
      </p>

      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h3>Add your child's profile</h3>
          <p>Tap <strong>Add Child</strong> in the app, enter their name and age, and Snappy Study will tailor content to their level.</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h3>Generate a QR code for them</h3>
          <p>Each child gets a unique QR code. They scan it on their device to log straight into their own session — no passwords needed.</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h3>Snap a photo to start learning</h3>
          <p>Your child points the camera at any object, book page, or worksheet. Snappy Study analyses the image and generates age-appropriate questions and explanations instantly.</p>
        </div>
      </div>

      <div class="step">
        <div class="step-number">4</div>
        <div class="step-content">
          <h3>Track progress from your account</h3>
          <p>Log back in as a parent any time to see what your children have been studying and how they're progressing.</p>
        </div>
      </div>

      <hr class="divider" />

      <div class="cta">
        <a href="https://snappystudy.com">Open Snappy Study</a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
    </div>

    <div class="footer">
      <p style="margin:0 0 8px;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
      <p style="margin:0;">You received this email because you created a Snappy Study account.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildWelcomeText(displayName) {
  return `Welcome to Snappy Study, ${escapeHtml(displayName)}!

You're all set. Here's how to get started:

1. Add your child's profile
   Tap "Add Child" in the app and enter their name and age.

2. Generate a QR code for them
   Each child gets a unique QR code they scan to log in — no password needed.

3. Snap a photo to start learning
   Your child points the camera at any object or worksheet. Snappy Study analyses the image and generates age-appropriate questions instantly.

4. Track progress from your account
   Log back in as a parent any time to see what your children have been studying.

Questions? Reply to this email and we'll help.

— The Snappy Study team
https://snappystudy.com
`;
}

// ---------------------------------------------------------------------------

async function sendWelcomeEmail(email, displayName) {
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Welcome to Snappy Study, ${escapeHtml(displayName)}! 🎉`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildWelcomeHtml(displayName), Charset: 'UTF-8' },
        Text: { Data: buildWelcomeText(displayName), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] welcome sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    // Never rethrow — a failed email must not break registration
    console.error(`[email] failed to send welcome to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Trial-started email
// ---------------------------------------------------------------------------

function buildTrialHtml(displayName, trialEndsAt) {
  const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Free Trial Has Started</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.85); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 24px; }
    .trial-box { background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px 24px; margin: 0 0 32px; text-align: center; }
    .trial-box .label { font-size: 13px; font-weight: 600; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px; }
    .trial-box .date { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
    .upgrade-box { background: #eff6ff; border-radius: 12px; padding: 20px 24px; margin: 0 0 32px; }
    .upgrade-box p { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #374151; }
    .cta { text-align: center; margin: 0 0 32px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 700; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎉 Trial Started!</h1>
      <p>7 days of free access for your family</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)}!</p>
      <p class="intro">
        Your 7-day free trial of Snappy Study has begun. You have full access to all features — add children, generate QR codes, and start learning together.
      </p>

      <div class="trial-box">
        <p class="label">Your trial expires on</p>
        <p class="date">${escapeHtml(expiryDate)}</p>
      </div>

      <div class="upgrade-box">
        <p>
          After your trial, you can continue with the <strong>Standard Plan at $4.99/month</strong>.
          Open the app and go to <strong>Account → Subscription</strong> to upgrade at any time — cancel whenever you want.
        </p>
      </div>

      <div class="cta">
        <a href="https://snappystudy.com">Open Snappy Study</a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0 0 8px;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
      <p style="margin:0;">You received this because you started a Snappy Study trial.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildTrialText(displayName, trialEndsAt) {
  const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return `Hi ${escapeHtml(displayName)},

Your 7-day free trial of Snappy Study has started!

Your trial expires on: ${escapeHtml(expiryDate)}

After your trial, you can continue with the Standard Plan at $4.99/month.
Open the app → Account → Subscription to upgrade anytime.

Questions? Reply to this email.

— The Snappy Study team
https://snappystudy.com
`;
}

async function sendTrialStartedEmail(email, displayName, trialEndsAt) {
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Your Snappy Study free trial has started 🎉`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildTrialHtml(displayName, trialEndsAt), Charset: 'UTF-8' },
        Text: { Data: buildTrialText(displayName, trialEndsAt), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] trial-started sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send trial-started to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

function buildVerificationHtml(displayName, verifyUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Snappy Study email</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.85); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 32px; }
    .cta { text-align: center; margin: 0 0 32px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 700; }
    .url-fallback { font-size: 12px; color: #aaa; text-align: center; word-break: break-all; margin: 0 0 24px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📚 Snappy Study</h1>
      <p>One tap to confirm your email</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)}!</p>
      <p class="intro">
        Thanks for signing up. Please verify your email address to activate your account and start learning together.
      </p>
      <div class="cta">
        <a href="${escapeHtml(verifyUrl)}">Verify Email Address</a>
      </div>
      <p class="url-fallback">
        Or copy and paste this link into your browser:<br />${escapeHtml(verifyUrl)}
      </p>
      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        This link expires in 24 hours. If you didn't create a Snappy Study account, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function buildVerificationText(displayName, verifyUrl) {
  return `Hi ${escapeHtml(displayName)},

Please verify your Snappy Study email address by visiting the link below:

${escapeHtml(verifyUrl)}

This link expires in 24 hours. If you didn't sign up, you can ignore this email.

— The Snappy Study team
`;
}

async function sendVerificationEmail(email, displayName, verifyUrl) {
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Verify your Snappy Study email address`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildVerificationHtml(displayName, verifyUrl), Charset: 'UTF-8' },
        Text: { Data: buildVerificationText(displayName, verifyUrl), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] verification sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send verification to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

function buildPasswordResetHtml(displayName, resetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Snappy Study password</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.85); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 32px; }
    .cta { text-align: center; margin: 0 0 32px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 700; }
    .url-fallback { font-size: 12px; color: #aaa; text-align: center; word-break: break-all; margin: 0 0 24px; }
    .notice { background: #fef9f0; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #92400e; margin: 0 0 24px; line-height: 1.6; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🔐 Password Reset</h1>
      <p>Snappy Study account security</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)}!</p>
      <p class="intro">
        We received a request to reset your Snappy Study password. Click the button below to choose a new one.
      </p>
      <div class="cta">
        <a href="${escapeHtml(resetUrl)}">Reset My Password</a>
      </div>
      <p class="url-fallback">
        Or copy and paste this link into your browser:<br />${escapeHtml(resetUrl)}
      </p>
      <div class="notice">
        ⏱ This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.
      </div>
      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        Questions? Reply to this email and we'll help.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function buildPasswordResetText(displayName, resetUrl) {
  return `Hi ${escapeHtml(displayName)},

We received a request to reset your Snappy Study password.

Click the link below to set a new password:
${escapeHtml(resetUrl)}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email — your password won't change.

— The Snappy Study team
https://snappystudy.com
`;
}

async function sendPasswordResetEmail(email, displayName, resetUrl) {
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Reset your Snappy Study password`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildPasswordResetHtml(displayName, resetUrl), Charset: 'UTF-8' },
        Text: { Data: buildPasswordResetText(displayName, resetUrl), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] password-reset sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send password-reset to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Subscription confirmed email
// ---------------------------------------------------------------------------

// Per-tier copy used in subscription-related emails. Keeping it in one place
// here so the price/feature lines stay consistent across all templates.
const PLAN_INFO = {
  standard: {
    label:    'Standard — €4.99/month',
    profiles: '1 child profile',
  },
  family: {
    label:    'Family — €12.99/month',
    profiles: 'Up to 4 child profiles',
  },
};

function planInfo(tier) {
  return PLAN_INFO[tier] || PLAN_INFO.standard;
}

function buildSubscriptionConfirmedHtml(displayName, periodEnd, tier) {
  const renewDate = new Date(periodEnd).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const plan = planInfo(tier);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subscription Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.85); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 28px; }
    .info-box { background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #d1fae5; }
    .info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .info-label { font-size: 13px; color: #065f46; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .info-value { font-size: 14px; font-weight: 700; color: #111827; }
    .feature-list { list-style: none; padding: 0; margin: 0 0 28px; }
    .feature-list li { display: flex; align-items: center; font-size: 14px; color: #374151; padding: 6px 0; }
    .feature-list li::before { content: "✓"; color: #10b981; font-weight: 700; margin-right: 10px; font-size: 16px; }
    .cta { text-align: center; margin: 0 0 28px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 700; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎉 You're subscribed!</h1>
      <p>Snappy Study ${escapeHtml(plan.label.split(' — ')[0])} Plan</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)}!</p>
      <p class="intro">
        Thank you for subscribing to Snappy Study. Your payment was successful and your account is now fully active.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Plan</span>
          <span class="info-value">${escapeHtml(plan.label)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Next renewal</span>
          <span class="info-value">${escapeHtml(renewDate)}</span>
        </div>
      </div>

      <ul class="feature-list">
        <li>${escapeHtml(plan.profiles)}</li>
        <li>Unlimited photo-to-text analysis</li>
        <li>QR code child login</li>
        <li>Multi-language support</li>
      </ul>

      <div class="cta">
        <a href="https://snappystudy.com">Open Snappy Study</a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        You can cancel anytime from <strong>Account → Subscription</strong> in the app.
        Questions? Reply to this email and we'll help.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0 0 8px;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
      <p style="margin:0;">You received this because you subscribed to Snappy Study.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildSubscriptionConfirmedText(displayName, periodEnd, tier) {
  const renewDate = new Date(periodEnd).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const plan = planInfo(tier);
  return `Hi ${escapeHtml(displayName)},

Thank you for subscribing to Snappy Study! Your payment was successful.

Plan: ${plan.label}
Next renewal: ${escapeHtml(renewDate)}

What's included:
- ${plan.profiles}
- Unlimited photo-to-text analysis
- QR code child login
- Multi-language support

You can cancel anytime from Account → Subscription in the app.

Questions? Reply to this email.

— The Snappy Study team
https://snappystudy.com
`;
}

async function sendSubscriptionConfirmedEmail(email, displayName, periodEnd, tier) {
  const planLabel = planInfo(tier).label.split(' — ')[0];
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Welcome to Snappy Study ${planLabel} 🎉`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildSubscriptionConfirmedHtml(displayName, periodEnd, tier), Charset: 'UTF-8' },
        Text: { Data: buildSubscriptionConfirmedText(displayName, periodEnd, tier), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] subscription-confirmed (${tier || 'standard'}) sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send subscription-confirmed to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Plan changed (upgrade / downgrade) email
// ---------------------------------------------------------------------------

function buildPlanChangedHtml(displayName, periodEnd, fromTier, toTier) {
  const renewDate = new Date(periodEnd).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const from = planInfo(fromTier);
  const to   = planInfo(toTier);
  const isUpgrade = (fromTier === 'standard' && toTier === 'family');
  const headline = isUpgrade ? '✨ Welcome to Family' : 'Your plan has been updated';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(headline)}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #7c2d12 0%, #fbbf24 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.9); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 28px; }
    .change-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 0 0 28px; }
    .pill { padding: 10px 18px; border-radius: 999px; background: #f3f4f6; color: #6b7280; font-weight: 700; font-size: 13px; }
    .pill.to { background: #fef3c7; color: #7c2d12; }
    .arrow { color: #9ca3af; font-size: 22px; }
    .info-box { background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .info-label { font-size: 13px; color: #7c2d12; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .info-value { font-size: 14px; font-weight: 700; color: #111827; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${escapeHtml(headline)}</h1>
      <p>${escapeHtml(to.label.split(' — ')[0])} Plan is now active</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)}!</p>
      <p class="intro">
        Your Snappy Study subscription has been changed. Here's what's different:
      </p>

      <div class="change-row">
        <span class="pill">${escapeHtml(from.label.split(' — ')[0])}</span>
        <span class="arrow">→</span>
        <span class="pill to">${escapeHtml(to.label.split(' — ')[0])}</span>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">New plan</span>
          <span class="info-value">${escapeHtml(to.label)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Includes</span>
          <span class="info-value">${escapeHtml(to.profiles)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Next renewal</span>
          <span class="info-value">${escapeHtml(renewDate)}</span>
        </div>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        Manage your subscription anytime from your App Store or Google Play account settings.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0;">Snappy Study &mdash; snappystudy.com</p>
    </div>
  </div>
</body>
</html>`;
}

function buildPlanChangedText(displayName, periodEnd, fromTier, toTier) {
  const renewDate = new Date(periodEnd).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const from = planInfo(fromTier);
  const to   = planInfo(toTier);
  return `Hi ${escapeHtml(displayName)},

Your Snappy Study subscription has been changed:

${from.label.split(' — ')[0]}  →  ${to.label.split(' — ')[0]}

New plan: ${to.label}
Includes:  ${to.profiles}
Next renewal: ${escapeHtml(renewDate)}

Manage your subscription anytime from your App Store or Google Play account settings.

— The Snappy Study team
https://snappystudy.com
`;
}

async function sendPlanChangedEmail(email, displayName, periodEnd, fromTier, toTier) {
  const subject = (fromTier === 'standard' && toTier === 'family')
    ? `You've upgraded to Snappy Study Family ✨`
    : `Your Snappy Study plan has been updated`;
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildPlanChangedHtml(displayName, periodEnd, fromTier, toTier), Charset: 'UTF-8' },
        Text: { Data: buildPlanChangedText(displayName, periodEnd, fromTier, toTier), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] plan-changed ${fromTier}→${toTier} sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send plan-changed to ${email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Subscription cancelled email
// ---------------------------------------------------------------------------

function buildSubscriptionCancelledHtml(displayName, accessUntil) {
  const accessDate = new Date(accessUntil).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subscription Cancelled</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6b7280 0%, #374151 100%); padding: 48px 40px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 16px; color: rgba(255,255,255,0.75); }
    .body { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 28px; }
    .access-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; padding: 24px; margin: 0 0 28px; text-align: center; }
    .access-box .label { font-size: 13px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; }
    .access-box .date { font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 8px; }
    .access-box .note { font-size: 13px; color: #78350f; margin: 0; line-height: 1.5; }
    .resubscribe-box { background: #eff6ff; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px; }
    .resubscribe-box p { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #374151; }
    .resubscribe-box p:last-child { margin: 0; }
    .cta { text-align: center; margin: 0 0 28px; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 700; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #6c63ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Subscription Cancelled</h1>
      <p>We're sorry to see you go</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${escapeHtml(displayName)},</p>
      <p class="intro">
        Your Snappy Study subscription has been cancelled. No further payments will be taken. You still have full access until the end of your current billing period.
      </p>

      <div class="access-box">
        <p class="label">Full access until</p>
        <p class="date">${escapeHtml(accessDate)}</p>
        <p class="note">All features remain available until this date — no interruption to your children's learning.</p>
      </div>

      <div class="resubscribe-box">
        <p>Changed your mind? You can resubscribe any time from <strong>Account → Subscription</strong> in the app and pick up right where you left off.</p>
        <p>If there's anything we could have done better, just reply to this email — we'd love to hear from you.</p>
      </div>

      <div class="cta">
        <a href="https://snappystudy.com">Open Snappy Study</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 8px;">Snappy Study &mdash; <a href="https://snappystudy.com">snappystudy.com</a></p>
      <p style="margin:0;">You received this because you cancelled your Snappy Study subscription.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildSubscriptionCancelledText(displayName, accessUntil) {
  const accessDate = new Date(accessUntil).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return `Hi ${escapeHtml(displayName)},

Your Snappy Study subscription has been cancelled. No further payments will be taken.

You still have full access to all features until: ${escapeHtml(accessDate)}

After that date, your account will revert to a free plan.

Changed your mind? Open the app → Account → Subscription to resubscribe anytime.

If there's anything we could have done better, just reply to this email.

— The Snappy Study team
https://snappystudy.com
`;
}

async function sendSubscriptionCancelledEmail(email, displayName, accessUntil) {
  const command = new SendEmailCommand({
    Source: `Snappy Study <${SENDER}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Your Snappy Study subscription has been cancelled`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: buildSubscriptionCancelledHtml(displayName, accessUntil), Charset: 'UTF-8' },
        Text: { Data: buildSubscriptionCancelledText(displayName, accessUntil), Charset: 'UTF-8' },
      },
    },
  });

  try {
    const result = await getClient().send(command);
    console.log(`[email] subscription-cancelled sent to ${email} (messageId=${result.MessageId})`);
  } catch (err) {
    console.error(`[email] failed to send subscription-cancelled to ${email}: ${err.message}`);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendTrialStartedEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmedEmail,
  sendSubscriptionCancelledEmail,
  sendPlanChangedEmail,
};
