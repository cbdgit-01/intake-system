import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit, X, Check, Shield, User as UserIcon, Database, FileX, Search, AlertTriangle, Eye, Mail, Lock } from 'lucide-react';
import { useAuth, User } from '../store/useAuth';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { getAllForms, deleteForm, factoryResetDatabase } from '../db';
import { IntakeForm } from '../types';

export default function UserManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser, loadUsers, factoryResetUsers } = useAuth();
  const { triggerFormsRefresh, loadExistingForm, setIntakeStep, setView, setDocumentOnlyPreview } = useStore();
  const navigate = useNavigate();
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'data' | 'email'>('users');
  const [allForms, setAllForms] = useState<IntakeForm[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Factory reset state
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  const [factoryResetConfirm, setFactoryResetConfirm] = useState('');
  const [factoryResetPassword, setFactoryResetPassword] = useState('');
  const [factoryResetError, setFactoryResetError] = useState('');
  
  // Expanded consigner in data management
  const [expandedConsigner, setExpandedConsigner] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
    loadUsers();
  }, [loadUsers]);

  const loadForms = async () => {
    const forms = await getAllForms();
    setAllForms(forms);
  };

  const handleClearAllForms = async () => {
    if (confirm('Are you sure you want to delete ALL intake records? This cannot be undone. User accounts will be preserved.')) {
      for (const form of allForms) {
        await deleteForm(form.id);
      }
      await loadForms();
      triggerFormsRefresh();
      setSuccessMessage('All records have been cleared.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleDeleteSingleForm = async (formId: string, consignerName: string) => {
    if (confirm(`Delete record for "${consignerName || 'Unknown'}"?`)) {
      await deleteForm(formId);
      await loadForms();
      triggerFormsRefresh();
      setSuccessMessage('Record deleted.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handlePreviewForm = async (formId: string) => {
    await loadExistingForm(formId, true); // true = view only
    setDocumentOnlyPreview(true); // Show just the document
    setIntakeStep('preview');
    setView('intake');
    navigate('/');
  };

  const handleFactoryReset = async () => {
    setFactoryResetError('');
    
    // Validate confirmation text
    if (factoryResetConfirm.toLowerCase() !== 'confirm') {
      setFactoryResetError('Please type "confirm" to proceed');
      return;
    }
    
    if (!factoryResetPassword) {
      setFactoryResetError('Please enter your password');
      return;
    }
    
    // Perform factory reset
    await factoryResetDatabase();
    await factoryResetUsers();
    
    // This will log out the user and redirect to login
  };

  // Group forms by consigner
  const getConsignerKey = (form: IntakeForm) => form.consignerNumber || form.consignerName || form.id;
  
  const groupedConsigners = allForms.reduce((acc, form) => {
    const key = getConsignerKey(form);
    if (!acc[key]) {
      acc[key] = {
        key,
        name: form.consignerName || '',
        number: form.consignerNumber || '',
        address: form.consignerAddress || '',
        phone: form.consignerPhone || '',
        forms: [],
      };
    }
    acc[key].forms.push(form);
    // Update info if we have better data
    if (form.consignerName && !acc[key].name) acc[key].name = form.consignerName;
    if (form.consignerAddress && !acc[key].address) acc[key].address = form.consignerAddress;
    if (form.consignerPhone && !acc[key].phone) acc[key].phone = form.consignerPhone;
    return acc;
  }, {} as Record<string, { key: string; name: string; number: string; address: string; phone: string; forms: IntakeForm[] }>);

  // Sort forms within each consigner by date (oldest first for numbering)
  Object.values(groupedConsigners).forEach(consigner => {
    consigner.forms.sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  });

  // Filter consigners based on search
  const filteredConsigners = Object.values(groupedConsigners).filter((consigner) => {
    if (!searchTerm.trim()) return false; // Require search
    const search = searchTerm.toLowerCase();
    return (
      consigner.name?.toLowerCase().includes(search) ||
      consigner.number?.toLowerCase().includes(search)
    );
  });

  // Only admins can manage users
  if (currentUser?.role !== 'admin') {
    return (
      <div className="st-warning">
        Only administrators can access this page.
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h2 className="text-xl font-semibold mb-6">Admin Settings</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-primary text-white'
              : 'st-button'
          }`}
        >
          <UserIcon size={18} className="inline mr-2" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'data'
              ? 'bg-primary text-white'
              : 'st-button'
          }`}
        >
          <Database size={18} className="inline mr-2" />
          Data Management
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'email'
              ? 'bg-primary text-white'
              : 'st-button'
          }`}
        >
          <Mail size={18} className="inline mr-2" />
          Email Settings
        </button>
      </div>

      {error && <div className="st-error mb-4">{error}</div>}
      {successMessage && <div className="st-success mb-4">{successMessage}</div>}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">User Accounts</h3>
            <button
              onClick={() => {
                setShowAddUser(true);
                setError('');
              }}
              className="st-button-primary"
            >
              <UserPlus size={18} className="inline mr-2" />
              Add User
            </button>
          </div>

          {/* Add User Form */}
          {showAddUser && (
            <AddUserForm
              onAdd={async (userData) => {
                const result = await addUser(userData);
                if (result.success) {
                  setShowAddUser(false);
                  setError('');
                } else {
                  setError(result.error || 'Failed to add user');
                }
              }}
              onCancel={() => {
                setShowAddUser(false);
                setError('');
              }}
            />
          )}

          {/* Users List */}
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="st-card">
                {editingUser === user.id ? (
                  <EditUserForm
                    user={user}
                    onSave={async (updates) => {
                      const success = await updateUser(user.id, updates);
                      if (success) {
                        setEditingUser(null);
                        setError('');
                      } else {
                        setError('Failed to update user');
                      }
                    }}
                    onCancel={() => {
                      setEditingUser(null);
                      setError('');
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${user.role === 'admin' ? 'bg-primary/10 text-primary' : ''} 
                      `}
                      style={user.role !== 'admin' ? { backgroundColor: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                      >
                        {user.role === 'admin' ? <Shield size={20} /> : <UserIcon size={20} />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>
                          )}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          @{user.username} • {user.role}
                          {user.email && ` • ${user.email}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user.id);
                          setError('');
                        }}
                        className="st-button text-sm"
                        title="Edit user"
                      >
                        <Edit size={16} />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={async () => {
                            if (confirm(`Delete user "${user.name}"?`)) {
                              const success = await deleteUser(user.id);
                              if (!success) {
                                setError('Cannot delete this user');
                              }
                            }
                          }}
                          className="st-button text-sm text-error"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="st-divider" />
          
          <p className="st-caption">
            {users.length} user{users.length !== 1 ? 's' : ''} total •{' '}
            {users.filter((u) => u.role === 'admin').length} admin{users.filter((u) => u.role === 'admin').length !== 1 ? 's' : ''}
          </p>
        </>
      )}

      {/* Data Management Tab */}
      {activeTab === 'data' && (
        <>
          <div>
            <h3 className="text-lg font-medium mb-4">Delete Individual Records</h3>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="st-input pl-10"
                  placeholder="Search by name or consigner number..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setExpandedConsigner(null); // Reset expansion on new search
                  }}
                />
              </div>
            </div>
            
            {allForms.length === 0 ? (
              <p className="st-caption">No records in the database.</p>
            ) : !searchTerm.trim() ? (
              <p className="st-caption">Enter a name or consigner number to find accounts.</p>
            ) : filteredConsigners.length === 0 ? (
              <p className="st-caption">No accounts match your search.</p>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Found {filteredConsigners.length} account(s)
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredConsigners.map((consigner) => {
                    const isExpanded = expandedConsigner === consigner.key;
                    const totalForms = consigner.forms.length;
                    
                    return (
                      <div key={consigner.key} className="st-card">
                        {/* Consigner Header - Click to expand */}
                        <button
                          onClick={() => setExpandedConsigner(isExpanded ? null : consigner.key)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">
                                  {consigner.name || 'Unknown'}
                                </p>
                                {consigner.number && (
                                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)' }}>
                                    #{consigner.number}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {totalForms} form{totalForms !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {(consigner.address || consigner.phone) && (
                                <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                                  {consigner.address && consigner.address.split('\n')[0]}
                                  {consigner.address && consigner.phone && ' • '}
                                  {consigner.phone}
                                </p>
                              )}
                            </div>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>
                        </button>

                        {/* Expanded Forms List */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
                            {consigner.forms.map((form, idx) => {
                              const formNumber = idx + 1;
                              const dateStr = form.updatedAt 
                                ? new Date(form.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '';
                              
                              return (
                                <div 
                                  key={form.id} 
                                  className="flex items-center justify-between gap-3 p-3 rounded-lg"
                                  style={{ backgroundColor: 'var(--surface)' }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">
                                      Form {formNumber} of {totalForms}
                                      {form.status === 'signed' && (
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                                          Signed
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {dateStr && `${dateStr} • `}
                                      {form.items?.length || 0} items
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreviewForm(form.id);
                                      }}
                                      className="st-button text-sm flex-shrink-0"
                                      title="Preview form"
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSingleForm(form.id, `${consigner.name} - Form ${formNumber}`);
                                      }}
                                      className="st-button text-sm text-error flex-shrink-0"
                                      title="Delete this form"
                                    >
                                      <FileX size={16} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="st-divider" />

          <div>
            <h3 className="text-lg font-medium mb-2">Clear All Records</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              This will permanently delete all intake records. User accounts and settings will be preserved.
            </p>
            <button
              onClick={handleClearAllForms}
              disabled={allForms.length === 0}
              className="st-button text-error"
            >
              <Trash2 size={18} className="inline mr-2" />
              Clear All Records ({allForms.length})
            </button>
          </div>

          <div className="st-divider" />

          {/* Factory Reset */}
          <div>
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-error">
              <AlertTriangle size={20} />
              Factory Reset
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              This will permanently delete <strong>ALL data</strong> including:
            </p>
            <ul className="text-sm mb-4 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
              <li>All intake records and forms</li>
              <li>All consigner data</li>
              <li>All settings and preferences</li>
            </ul>
            
            {!showFactoryReset ? (
              <button
                onClick={() => setShowFactoryReset(true)}
                className="st-button text-error"
              >
                <AlertTriangle size={18} className="inline mr-2" />
                Factory Reset...
              </button>
            ) : (
              <div className="st-card" style={{ borderColor: 'var(--error)', borderWidth: '2px' }}>
                <p className="font-medium text-error mb-4">⚠️ This action cannot be undone!</p>
                
                {factoryResetError && (
                  <div className="st-error mb-4">{factoryResetError}</div>
                )}
                
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="st-label">Type "confirm" to proceed</label>
                    <input
                      type="text"
                      className="st-input"
                      value={factoryResetConfirm}
                      onChange={(e) => setFactoryResetConfirm(e.target.value)}
                      placeholder="Type confirm"
                    />
                  </div>
                  
                  <div>
                    <label className="st-label">Enter your password</label>
                    <input
                      type="password"
                      className="st-input"
                      value={factoryResetPassword}
                      onChange={(e) => setFactoryResetPassword(e.target.value)}
                      placeholder="Your password"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowFactoryReset(false);
                      setFactoryResetConfirm('');
                      setFactoryResetPassword('');
                      setFactoryResetError('');
                    }}
                    className="st-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFactoryReset}
                    className="st-button bg-error text-white hover:bg-error/80"
                    disabled={!factoryResetConfirm || !factoryResetPassword}
                  >
                    <Trash2 size={18} className="inline mr-2" />
                    Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Email Settings Tab */}
      {activeTab === 'email' && (
        <EmailSettingsAdmin />
      )}
    </div>
  );
}

// Inline Email Settings for Admin
function EmailSettingsAdmin() {
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Consigned By Design');
  const [isConfigured, setIsConfigured] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Load existing config
    const stored = localStorage.getItem('cbd-intake-email-config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        setApiKey(config.apiKey || '');
        setFromEmail(config.fromEmail || '');
        setFromName(config.fromName || 'Consigned By Design');
        setIsConfigured(!!(config.apiKey && config.fromEmail));
      } catch (e) {
        console.error('Error loading email config:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('cbd-intake-email-config', JSON.stringify({
      apiKey: apiKey.trim(),
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim(),
    }));
    setIsConfigured(true);
    setSaveMessage('Email settings saved!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleClear = () => {
    if (confirm('Remove email configuration?')) {
      localStorage.removeItem('cbd-intake-email-config');
      setApiKey('');
      setFromEmail('');
      setFromName('Consigned By Design');
      setIsConfigured(false);
      setTestStatus('idle');
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setTestError('Enter an email to send test to');
      setTestStatus('error');
      return;
    }

    handleSave(); // Save first
    setTestStatus('sending');
    setTestError('');

    try {
      const API_URL = import.meta.env.VITE_DETECTION_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: testEmail,
          to_name: 'Test User',
          from_email: fromEmail,
          from_name: fromName,
          subject: 'Test Email from CBD Intake',
          message: 'This is a test email. If you received this, email is configured correctly!',
          api_key: apiKey,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(data.error || 'Failed to send');
      }
    } catch (e) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Network error');
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Email Configuration (Brevo)</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Configure email sending for intake receipts. Emails will include the intake form as a PDF attachment.
      </p>

      {/* Setup Instructions */}
      <div className="st-card mb-6">
        <p className="font-medium mb-2">Setup:</p>
        <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>Create account at <a href="https://www.brevo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">brevo.com</a></li>
          <li>Go to SMTP & API → API Keys</li>
          <li>Create a new API key and paste below</li>
        </ol>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Free tier: 300 emails/day (no domain verification required)
        </p>
      </div>

      {/* Config Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="st-label">API Key *</label>
          <input
            type="password"
            className="st-input"
            placeholder="xkeysib-xxxxxxxxx..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div>
          <label className="st-label">From Email *</label>
          <input
            type="email"
            className="st-input"
            placeholder="noreply@yourdomain.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Use your Brevo account email or any verified sender
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

      {/* Status Messages */}
      {saveMessage && <div className="st-success mb-4">{saveMessage}</div>}
      {isConfigured && !saveMessage && <div className="st-success mb-4">Email is configured</div>}
      {testStatus === 'success' && <div className="st-success mb-4">Test email sent!</div>}
      {testStatus === 'error' && <div className="st-error mb-4">{testError}</div>}

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || !fromEmail.trim()}
          className="st-button-primary"
        >
          Save Configuration
        </button>
        {isConfigured && (
          <button onClick={handleClear} className="st-button text-error">
            Remove
          </button>
        )}
      </div>

      {/* Test Section */}
      {apiKey && fromEmail && (
        <div className="st-card">
          <p className="font-medium mb-3">Send Test Email</p>
          <div className="flex gap-3">
            <input
              type="email"
              className="st-input flex-1"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <button
              onClick={handleTestEmail}
              disabled={testStatus === 'sending' || !testEmail}
              className="st-button"
            >
              {testStatus === 'sending' ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AddUserFormProps {
  onAdd: (user: { username: string; email: string; password: string; name: string; role: 'admin' | 'staff' }) => void;
  onCancel: () => void;
}

function AddUserForm({ onAdd, onCancel }: AddUserFormProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ username, name, email, password, role });
  };

  return (
    <form onSubmit={handleSubmit} className="st-card mb-4 border-primary">
      <h3 className="font-medium mb-4">Add New User</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="st-label">Name</label>
          <input
            type="text"
            className="st-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <label className="st-label">Username</label>
          <input
            type="text"
            className="st-input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="username"
            required
          />
        </div>
        <div>
          <label className="st-label">
            <Mail size={14} className="inline mr-1" />
            Email
          </label>
          <input
            type="email"
            className="st-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>
        <div>
          <label className="st-label">
            <Lock size={14} className="inline mr-1" />
            Password
          </label>
          <input
            type="password"
            className="st-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="st-label">Role</label>
          <select
            className="st-select"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="st-button">
          Cancel
        </button>
        <button type="submit" className="st-button-primary">
          <Check size={18} className="inline mr-1" />
          Add User
        </button>
      </div>
    </form>
  );
}

interface EditUserFormProps {
  user: User;
  onSave: (updates: Partial<{ username: string; name: string; role: 'admin' | 'staff' }>) => void;
  onCancel: () => void;
}

function EditUserForm({ user, onSave, onCancel }: EditUserFormProps) {
  const [username, setUsername] = useState(user.username);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ username, name, role });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <input
          type="text"
          className="st-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
        />
        <input
          type="text"
          className="st-input"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="Username"
          required
        />
        <select
          className="st-select"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="st-button text-sm">
          <X size={16} className="inline mr-1" />
          Cancel
        </button>
        <button type="submit" className="st-button-primary text-sm">
          <Check size={16} className="inline mr-1" />
          Save
        </button>
      </div>
    </form>
  );
}
