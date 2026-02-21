import { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { getEmailStatus, sendEmail } from '../lib/emailService';

interface EmailSettingsProps {
  onClose?: () => void;
}

export default function EmailSettings({ onClose }: EmailSettingsProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Test email
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setIsLoading(true);
    const status = await getEmailStatus();
    setIsConfigured(status.configured);
    setFromEmail(status.from_email || '');
    setFromName(status.from_name || 'Consigned By Design');
    setIsLoading(false);
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setTestError('Please enter an email address');
      setTestStatus('error');
      return;
    }

    setTestStatus('sending');
    setTestError('');

    const result = await sendEmail({
      to_email: testEmail,
      to_name: 'Test User',
      from_name: fromName,
      subject: 'Test Email from CBD Intake',
      message: 'This is a test email to verify your Gmail SMTP configuration is working correctly.\n\nIf you received this, your email settings are configured properly!',
    });

    if (result.success) {
      setTestStatus('success');
    } else {
      setTestStatus('error');
      setTestError(result.error || 'Unknown error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-text-secondary">Checking email configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mail size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Email Settings (Gmail SMTP)</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Send intake receipts with PDF attachments
          </p>
        </div>
      </div>

      {/* Status */}
      {isConfigured ? (
        <div className="st-success">
          <CheckCircle size={18} className="inline mr-2" />
          Gmail SMTP is configured and ready to send emails.
        </div>
      ) : (
        <div className="st-error">
          <AlertCircle size={18} className="inline mr-2" />
          Gmail SMTP is not configured. Set the environment variables on the server.
        </div>
      )}

      {/* Configuration details */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="space-y-3">
          <div>
            <label className="st-label">Sending From</label>
            <div className="st-input bg-transparent cursor-default" style={{ color: 'var(--text-secondary)' }}>
              {isConfigured ? `${fromName} <${fromEmail}>` : 'Not configured'}
            </div>
          </div>
        </div>
      </div>

      {/* Setup instructions (only show if not configured) */}
      {!isConfigured && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
          <p className="font-medium mb-2">Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>Enable 2-Step Verification on your Google Account</li>
            <li>Go to Google Account → Security → App Passwords</li>
            <li>Generate a new App Password for "Mail"</li>
            <li>Set these environment variables on Railway:</li>
          </ol>
          <div className="mt-3 p-3 rounded font-mono text-xs" style={{ backgroundColor: 'var(--background)' }}>
            <div>GMAIL_ADDRESS=your@gmail.com</div>
            <div>GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx</div>
            <div>GMAIL_FROM_NAME=Consigned By Design</div>
          </div>
        </div>
      )}

      {/* Test email section */}
      {isConfigured && (
        <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
          <label className="st-label">Send Test Email To:</label>
          <input
            type="email"
            className="st-input"
            placeholder="your@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button
            onClick={handleTestEmail}
            disabled={testStatus === 'sending' || !testEmail}
            className="w-full st-button-primary"
          >
            <Send size={18} className="inline mr-2" />
            {testStatus === 'sending' ? 'Sending test email...' : 'Send Test Email'}
          </button>

          {testStatus === 'success' && (
            <div className="st-success mt-2">
              <CheckCircle size={18} className="inline mr-2" />
              Test email sent! Check your inbox.
            </div>
          )}

          {testStatus === 'error' && (
            <div className="st-error mt-2">
              <AlertCircle size={18} className="inline mr-2" />
              {testError}
            </div>
          )}
        </div>
      )}

      {onClose && (
        <button onClick={onClose} className="w-full st-button">
          Close
        </button>
      )}
    </div>
  );
}
