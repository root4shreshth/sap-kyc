import nodemailer from 'nodemailer';

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export { isSmtpConfigured };

export async function sendKycInvite({ to, cc, clientName, companyName, link, companyProfile = null }) {
  if (!isSmtpConfigured()) {
    console.log('[DEMO] KYC invite email skipped. Link:', link);
    return;
  }
  const senderName = companyProfile?.emailSenderName || 'Al Amir Operations';
  const brandName = companyProfile?.name || 'AL AMIR GROUP HOLDING COMPANY.';
  const btnColor = companyProfile?.primaryColor || '#2563eb';
  const footer = companyProfile?.footerText || 'AL AMIR GROUP HOLDING COMPANY.';

  const transporter = getTransporter();
  const mailOptions = {
    from: `"${senderName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `KYC Verification Required – ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">${brandName}</h2>
        <p>Dear ${clientName},</p>
        <p>We require KYC verification for <strong>${companyName}</strong>. Please use the secure link below to submit your documents:</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:${btnColor};color:white;padding:12px 24px;text-decoration:none;border-radius:6px">Submit KYC Documents</a>
        </p>
        <p style="color:#666;font-size:14px">This link expires in 7 days. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#999;font-size:12px">${footer}</p>
      </div>`,
  };
  if (cc) mailOptions.cc = cc;
  await transporter.sendMail(mailOptions);
}

export async function sendKycReminder({ to, clientName, companyName, link, daysLeft, companyProfile = null }) {
  if (!isSmtpConfigured()) {
    console.log(`[DEMO] Reminder email skipped. ${clientName} → ${daysLeft} days left`);
    return;
  }
  const senderName = companyProfile?.emailSenderName || 'Al Amir Operations';
  const brandName = companyProfile?.name || 'AL AMIR GROUP HOLDING COMPANY.';
  const btnColor = companyProfile?.primaryColor || '#2563eb';
  const footer = companyProfile?.footerText || 'AL AMIR GROUP HOLDING COMPANY.';

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${senderName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Reminder: KYC Verification Pending – ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">${brandName}</h2>
        <p>Dear ${clientName},</p>
        <p>This is a friendly reminder that your KYC verification for <strong>${companyName}</strong> is still pending.
          Your submission link expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:${btnColor};color:white;padding:12px 24px;text-decoration:none;border-radius:6px">Submit KYC Documents</a>
        </p>
        <p style="color:#666;font-size:14px">Please complete your submission at your earliest convenience.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#999;font-size:12px">${footer}</p>
      </div>`,
  });
}

export async function sendStatusUpdate({ to, clientName, companyName, status, remarks, companyProfile = null }) {
  if (!isSmtpConfigured()) {
    console.log(`[DEMO] Status email skipped. ${clientName} → ${status}`);
    return;
  }
  const senderName = companyProfile?.emailSenderName || 'Al Amir Operations';
  const brandName = companyProfile?.name || 'AL AMIR GROUP HOLDING COMPANY.';
  const footer = companyProfile?.footerText || 'AL AMIR GROUP HOLDING COMPANY.';

  const transporter = getTransporter();
  const isApproved = status === 'Approved';
  await transporter.sendMail({
    from: `"${senderName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `KYC ${status} – ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a365d">${brandName}</h2>
        <p>Dear ${clientName},</p>
        <p>Your KYC verification for <strong>${companyName}</strong> has been
          <strong style="color:${isApproved ? '#16a34a' : '#dc2626'}">${status.toLowerCase()}</strong>.
        </p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
        ${isApproved
          ? '<p>You are now verified and may proceed with business operations.</p>'
          : '<p>Please contact us if you have questions regarding this decision.</p>'}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#999;font-size:12px">${footer}</p>
      </div>`,
  });
}
