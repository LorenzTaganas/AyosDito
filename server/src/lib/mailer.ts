import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import { log } from './logger';

let transporter: Transporter | null = null;

if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Returns true only when the SMTP transport accepted the message.
 * Without SMTP configuration nothing is sent. In development the route
 * handlers also print the action link and return it to the client so the
 * flow can be tested. Production requires SMTP to be configured.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  if (!transporter) {
    log('warn', 'Email not sent because SMTP is not configured.', { subject: message.subject });
    return false;
  }
  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return true;
  } catch (error) {
    log('error', 'Email delivery failed.', {
      subject: message.subject,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

export function verificationEmail(link: string): Omit<MailMessage, 'to'> {
  return {
    subject: 'Verify your AyosDito email',
    text: [
      'Welcome to AyosDito.',
      '',
      'Confirm your email address by opening this link:',
      link,
      '',
      'The link expires in 24 hours. If you did not create an account, you can ignore this email.',
    ].join('\n'),
  };
}

export function passwordResetEmail(link: string): Omit<MailMessage, 'to'> {
  return {
    subject: 'Reset your AyosDito password',
    text: [
      'We received a request to reset your AyosDito password.',
      '',
      'Open this link to choose a new password:',
      link,
      '',
      'The link expires in 30 minutes. If you did not request a reset, you can ignore this email.',
    ].join('\n'),
  };
}
