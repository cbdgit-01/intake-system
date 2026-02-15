// Email service for sending emails via backend API (Brevo)

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
}

interface EmailParams {
  to_email: string;
  to_name: string;
  from_name: string;
  subject: string;
  message: string;
  attachments?: EmailAttachment[];
}

// Store email config in localStorage
const STORAGE_KEY = 'cbd-intake-email-config';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || '';

export function getEmailConfig(): ResendConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading email config:', error);
  }
  return null;
}

export function saveEmailConfig(config: ResendConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearEmailConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  if (!config) return false;
  return !!(config.apiKey && config.fromEmail);
}

// Send email via backend API
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig();

  if (!config) {
    return { success: false, error: 'Email not configured. Please set up in Admin Settings.' };
  }

  // Create abort controller with 60 second timeout (Render free tier can have slow cold starts)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    console.log('[Email] Sending email via backend:', API_URL);

    const response = await fetch(`${API_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_email: params.to_email,
        to_name: params.to_name,
        from_email: config.fromEmail,
        from_name: config.fromName || params.from_name,
        subject: params.subject,
        message: params.message,
        attachments: params.attachments,
        api_key: config.apiKey,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Server error:', response.status, errorText);
      return { success: false, error: `Server error: ${response.status}` };
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
        return { success: false, error: 'Request timed out. The server may be starting up - please try again.' };
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
