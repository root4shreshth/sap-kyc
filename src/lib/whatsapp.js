export function isWhatsAppConfigured() {
  return !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function buildKycInviteMessage({ clientName, companyName, link }) {
  return [
    `Hello ${clientName},`,
    '',
    `We require KYC verification for *${companyName}*. Please use the secure link below to submit your documents:`,
    '',
    link,
    '',
    'This link expires in 7 days. Do not share it with anyone.',
  ].join('\n');
}

export function buildStatusUpdateMessage({ clientName, companyName, status, remarks }) {
  const lines = [
    `Hello ${clientName},`,
    '',
    `Your KYC verification for *${companyName}* has been *${status.toLowerCase()}*.`,
  ];
  if (remarks) {
    lines.push('', `Remarks: ${remarks}`);
  }
  if (status === 'Approved') {
    lines.push('', 'You are now verified and may proceed with business operations.');
  } else {
    lines.push('', 'Please contact us if you have questions regarding this decision.');
  }
  return lines.join('\n');
}

export function buildReminderMessage({ clientName, companyName, link, daysLeft }) {
  return [
    `Hello ${clientName},`,
    '',
    `This is a reminder that your KYC verification for *${companyName}* is still pending.`,
    `Your submission link expires in *${daysLeft} day${daysLeft !== 1 ? 's' : ''}*.`,
    '',
    link,
    '',
    'Please complete your submission at your earliest convenience.',
  ].join('\n');
}

export async function sendWhatsAppMessage({ to, message }) {
  if (!isWhatsAppConfigured()) {
    console.log(`[DEMO] WhatsApp message skipped. To: ${to}, Message preview: ${message.slice(0, 80)}...`);
    return { success: true, demo: true };
  }

  try {
    const res = await fetch(`${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `WhatsApp API error: ${res.status}`);
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('WhatsApp send error:', err);
    return { success: false, error: err.message };
  }
}
