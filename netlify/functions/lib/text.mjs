// Input-sanitising primitives shared by the deployed functions and the
// build/newsletter scripts.
//
// Each side used to carry its own copy, and they had drifted: the transactional
// pages escaped five characters while the digest/newsletter path escaped four,
// leaving apostrophes raw. One definition, the stricter one, for both.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Env values can pick up BOMs/whitespace when set via shell pipes — sanitize. */
export const cleanEnv = (value) => String(value || '').replace(/^﻿/, '').trim();

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
