// Email service for sending emails via backend Gmail SMTP

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
}

interface EmailParams {
  to_email: string;
  to_name: string;
  from_name?: string;
  subject: string;
  message: string;
  attachments?: EmailAttachment[];
}

interface EmailStatus {
  configured: boolean;
  from_email: string | null;
  from_name: string;
}

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || '';

// Check if Gmail SMTP is configured on the backend
export async function getEmailStatus(): Promise<EmailStatus> {
  try {
    const response = await fetch(`${API_URL}/api/email/status`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('[Email] Error checking email status:', error);
  }
  return { configured: false, from_email: null, from_name: 'Consigned By Design' };
}

export async function isEmailConfigured(): Promise<boolean> {
  const status = await getEmailStatus();
  return status.configured;
}

// Send email via backend Gmail SMTP
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    console.log('[Email] Sending email via backend Gmail SMTP');

    const response = await fetch(`${API_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_email: params.to_email,
        to_name: params.to_name,
        from_name: params.from_name,
        subject: params.subject,
        message: params.message,
        attachments: params.attachments,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Server error:', response.status, errorText);
      try {
        const errorData = JSON.parse(errorText);
        return { success: false, error: errorData.error || `Server error: ${response.status}` };
      } catch {
        return { success: false, error: `Server error: ${response.status}` };
      }
    }

    const responseData = await response.json();

    if (responseData.success) {
      console.log('[Email] Email sent successfully');
      return { success: true };
    } else {
      console.error('[Email] API error:', responseData.error);
      return { success: false, error: responseData.error || 'Failed to send email' };
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[Email] Request timed out after 60 seconds');
        return { success: false, error: 'Request timed out. Please try again.' };
      }
      console.error('[Email] Network error:', error.message);
      return { success: false, error: `Network error: ${error.message}` };
    }

    return { success: false, error: 'Unknown error sending email' };
  }
}

// Helper to send email with PDF attachment
export async function sendEmailWithPDF(
  params: Omit<EmailParams, 'attachments'>,
  pdfBase64: string,
  pdfFilename: string
): Promise<{ success: boolean; error?: string }> {
  // Remove the data URL prefix if present (e.g., "data:application/pdf;base64,")
  const base64Content = pdfBase64.includes(',')
    ? pdfBase64.split(',')[1]
    : pdfBase64;

  return sendEmail({
    ...params,
    attachments: [{
      filename: pdfFilename,
      content: base64Content,
    }],
  });
}
