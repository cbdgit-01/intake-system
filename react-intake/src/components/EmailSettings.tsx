import { useState, useEffect } from 'react';
import { Mail, Save, Trash2, ExternalLink, CheckCircle, AlertCircle, Info } from 'lucide-react';
import {
  getEmailConfig,
  saveEmailConfig,
  clearEmailConfig,
  isEmailConfigured,
  sendEmail,
} from '../lib/emailService';

interface EmailSettingsProps {
  onClose?: () => void;
}

export default function EmailSettings({ onClose }: EmailSettingsProps) {
  // Resend fields
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('onboarding@resend.dev');
  const [fromName, setFromName] = useState('Consigned By Design');

  // Status
  const [isConfigured, setIsConfigured] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    const config = getEmailConfig();
    if (config) {
      setApiKey(config.apiKey);
      setFromEmail(config.fromEmail || 'onboarding@resend.dev');
      setFromName(config.fromName || 'Consigned By Design');
    }
    setIsConfigured(isEmailConfigured());
  }, []);

  const handleSave = () => {
    saveEmailConfig({
      apiKey: apiKey.trim(),
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim(),
    });
    setIsConfigured(true);
    setTestStatus('idle');
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to remove email configuration?')) {
      clearEmailConfig();
      setApiKey('');
      setFromEmail('onboarding@resend.dev');
      setFromName('Consigned By Design');
      setIsConfigured(false);
      setTestStatus('idle');
    }
  };

  const handleTestEmail = async () => {
    if (!apiKey || !fromEmail) {
      setTestError('Please fill in API Key and From Email');
      setTestStatus('error');
      return;
    }

    if (!testEmail) {
      setTestError('Please enter an email address to send the test to');
      setTestStatus('error');
      return;
    }

    // Save config before testing
    handleSave();

    setTestStatus('sending');
    setTestError('');

    const result = await sendEmail({
      to_email: testEmail,
      to_name: 'Test User',
      from_name: fromName || 'CBD Intake',
      subject: 'Test Email from CBD Intake',
      message: 'This is a test email to verify your Resend configuration is working correctly.\n\nIf you received this, your email settings are configured properly!',
    });

    if (result.success) {
      setTestStatus('success');
    } else {
      setTestStatus('error');
      setTestError(result.error || 'Unknown error');
    }
  };

  const canSave = apiKey.trim() && fromEmail.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mail size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Email Settings (Resend)</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Send intake receipts with PDF attachments
          </p>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
        <p className="font-medium mb-2">Setup Instructions:</p>
        <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>Create a free account at <a href="https://resend.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a></li>
          <li>Go to <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">API Keys</a> and create a new key</li>
          <li>Paste your API key below</li>
          <li>Use the default test email or add your own domain later</li>
        </ol>
        <a
          href="https://resend.com/docs/introduction"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary mt-2"
        >
          <ExternalLink size={14} />
          View documentation
        </a>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Free tier: 3,000 emails/month, 100/day
        </p>
      </div>

      {/* Info about test domain */}
      <div className="p-4 rounded-lg border border-primary/30" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
        <div className="flex gap-2">
          <Info size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Test Mode Available</p>
            <p className="text-xs mt-1 opacity-90">
              You can start sending emails immediately using <code className="bg-white/20 px-1 rounded">onboarding@resend.dev</code> as the sender.
              Add your own domain later for custom sender addresses.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration form */}
      <div className="space-y-4">
        <div>
          <label className="st-label">API Key *</label>
          <input
            type="password"
            className="st-input"
            placeholder="re_xxxxxxxxx..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div>
          <label className="st-label">From Email *</label>
          <input
            type="email"
            className="st-input"
            placeholder="onboarding@resend.dev"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Use onboarding@resend.dev for testing, or your verified domain email
          </p>
        </div>

        <div>
          <label className="st-label">From Name</label>
          <input
            type="text"
            className="st-input"
            placeholder="Consigned By Design"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
      </div>

      {/* Status indicator */}
      {isConfigured && testStatus !== 'success' && testStatus !== 'error' && (
        <div className="st-success">
          <CheckCircle size={18} className="inline mr-2" />
          Resend is configured. Emails will be sent with PDF attachments.
        </div>
      )}

      {testStatus === 'success' && (
        <div className="st-success">
          <CheckCircle size={18} className="inline mr-2" />
          Test email sent successfully! Check your inbox.
        </div>
      )}

      {testStatus === 'error' && (
        <div className="st-error">
          <AlertCircle size={18} className="inline mr-2" />
          {testError || 'Configuration test failed'}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 st-button-primary"
        >
          <Save size={18} className="inline mr-2" />
          Save Configuration
        </button>

        {isConfigured && (
          <button onClick={handleClear} className="st-button text-error">
            <Trash2 size={18} className="inline mr-2" />
            Remove
          </button>
        )}
      </div>

      {/* Test email section */}
      {canSave && (
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
            className="w-full st-button"
          >
            {testStatus === 'sending' ? 'Sending test email...' : 'Send Test Email'}
          </button>
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
