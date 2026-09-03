import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Helper to read .env in Node environment
function getEnvConfig(): {
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  adminEmail: string;
} {
  let smtpUser = process.env.SMTP_USER || '';
  let smtpPass = process.env.SMTP_PASS || '';
  let smtpFrom = process.env.SMTP_FROM || '';
  let adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || '';

  // Attempt reading from .env directly if process.env values are unset
  if (!smtpUser || !smtpPass) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key === 'SMTP_USER') smtpUser = val;
            if (key === 'SMTP_PASS') smtpPass = val;
            if (key === 'SMTP_FROM') smtpFrom = val;
            if (key === 'ADMIN_NOTIFICATION_EMAIL') adminEmail = val;
          }
        }
      }
    } catch (e) {
      console.warn('[emailPlugin] Could not parse .env:', e);
    }
  }

  // Clean Gmail App Password (strip spaces)
  if (smtpPass) {
    smtpPass = smtpPass.replace(/\s+/g, '');
  }

  return {
    smtpUser,
    smtpPass,
    smtpFrom: smtpFrom || (smtpUser ? `BINHI Concept <${smtpUser}>` : 'BINHI Concept'),
    adminEmail: adminEmail || smtpUser,
  };
}

export function emailPlugin(): Plugin {
  return {
    name: 'binhi-email-plugin',
    configureServer(server: ViteDevServer) {
      setupEmailMiddleware(server.middlewares);
    },
    configurePreviewServer(server: PreviewServer) {
      setupEmailMiddleware(server.middlewares);
    },
  };
}

function setupEmailMiddleware(middlewares: any) {
  middlewares.use(async (req: any, res: any, next: any) => {
    // Only handle /api/send-email and /api/verify-smtp
    if (req.url?.startsWith('/api/verify-smtp')) {
      const { smtpUser, smtpPass } = getEnvConfig();
      if (!smtpUser || !smtpPass) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, simulated: true, message: 'SMTP credentials not configured in .env (Running in Dev Simulation Mode)' }));
        return;
      }

      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.verify();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'SMTP connection verified successfully' }));
      } catch (err: any) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'SMTP verification failed' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/send-email')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { to, subject, html, text, replyTo } = JSON.parse(body || '{}');

          if (!to || !subject || !html) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields: to, subject, or html' }));
            return;
          }

          const { smtpUser, smtpPass, smtpFrom } = getEnvConfig();
          if (!smtpUser || !smtpPass) {
            console.log(`\n[DEV SIMULATED EMAIL]`);
            console.log(`   To: ${to}`);
            console.log(`   Subject: ${subject}`);
            console.log(`   (Configure SMTP_USER & SMTP_PASS in .env for live email delivery)\n`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, simulated: true, messageId: `sim-${Date.now()}` }));
            return;
          }

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          const mailOptions = {
            from: smtpFrom,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            replyTo: replyTo || smtpUser,
          };

          const info = await transporter.sendMail(mailOptions);
          console.log(`[emailPlugin] Email sent successfully to ${to}. MessageId: ${info.messageId}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, messageId: info.messageId }));
        } catch (err: any) {
          console.warn('[emailPlugin] Send email failed, falling back to simulated log:', err.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, simulated: true, error: err.message, messageId: `fallback-${Date.now()}` }));
        }
      });
      return;
    }

    next();
  });
}

