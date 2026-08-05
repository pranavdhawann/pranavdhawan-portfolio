// Netlify fires this automatically whenever a form is submitted.
//
// For the newsletter form it sends a double opt-in confirmation email. Nothing
// is added to the send list here — scripts/send-newsletter.mjs only mails
// addresses that appear in the confirmed store, which confirm.mjs writes after
// the recipient clicks through. That means submitting somebody else's address
// costs them one email and never subscribes them.
import { confirmToken } from './lib/confirm-token.mjs';

const SITE_URL = process.env.SITE_URL || 'https://pranavdhawan.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanEnv = (value) => String(value || '').replace(/^﻿/, '').trim();

export function confirmUrlFor(email, secret, siteUrl = SITE_URL) {
  const token = confirmToken(email, secret);
  return `${siteUrl}/.netlify/functions/confirm?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
}

export function buildConfirmEmail(confirmUrl) {
  const text = [
    'Confirm your AI This Week subscription',
    '',
    'You (or someone using this address) asked for the weekly AI digest from',
    `${SITE_URL}/blog/. Confirm to start receiving it:`,
    '',
    confirmUrl,
    '',
    "If this wasn't you, ignore this email — nothing happens without that click.",
  ].join('\n');

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f2ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#ffffff;border:3px solid #1a1a1a;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:#FFD600;border-bottom:3px solid #1a1a1a;padding:18px 24px;">
  <div style="font-size:20px;font-weight:bold;letter-spacing:1px;color:#1a1a1a;">AI THIS WEEK</div>
</td></tr>
<tr><td style="padding:24px;font-size:15px;color:#1a1a1a;line-height:1.6;">
  <p style="margin:0 0 16px;">You (or someone using this address) asked for the weekly AI digest.
  Confirm to start receiving it:</p>
  <p style="margin:0 0 20px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#FFD600;border:3px solid #1a1a1a;
      padding:12px 20px;color:#1a1a1a;font-weight:bold;text-decoration:none;">Confirm subscription</a></p>
  <p style="margin:0;font-size:13px;color:#666;">If this wasn't you, ignore this email —
  nothing happens without that click.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { text, html };
}

export default async function handler(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  const submission = payload?.payload ?? payload;
  if (submission?.form_name !== 'newsletter') {
    return new Response('Ignored', { status: 200 });
  }

  const email = String(submission?.data?.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    console.warn('Newsletter submission with an unusable email address — skipping.');
    return new Response('Ignored', { status: 200 });
  }

  const secret = cleanEnv(process.env.UNSUBSCRIBE_SECRET);
  const [host, user, pass] = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].map((n) => cleanEnv(process.env[n]));
  if (!secret || !host || !user || !pass) {
    console.warn('Confirmation email not configured (needs UNSUBSCRIBE_SECRET + SMTP_*) — skipping.');
    return new Response('Not configured', { status: 200 });
  }

  const { default: nodemailer } = await import('nodemailer');
  const port = Number(cleanEnv(process.env.SMTP_PORT) || 587);
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass },
  });

  const { text, html } = buildConfirmEmail(confirmUrlFor(email, secret));

  try {
    await transport.sendMail({
      from: cleanEnv(process.env.NEWSLETTER_FROM) || user,
      to: email,
      subject: 'Confirm your AI This Week subscription',
      text,
      html,
    });
  } catch (error) {
    // Never fail the visitor's form submission over a mail hiccup.
    console.warn('Confirmation email failed to send', { message: error?.message });
  }

  return new Response('OK', { status: 200 });
}
