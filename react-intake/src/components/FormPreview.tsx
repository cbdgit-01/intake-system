import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { ArrowLeft, Download, Printer, CheckCircle, Home, FileText, ImageIcon, X, Mail, Send, Edit, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../store/useAuth';
import { isEmailConfigured as checkEmailConfigured, sendEmailWithPDF } from '../lib/emailService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function FormPreview() {
  const {
    currentForm,
    items,
    enabledFields,
    isViewOnly,
    signatureData,
    initials,
    signatureDate,
    acceptedBy,
    contractInitials,
    paymentPreference,
    setSignatureData,
    setInitials,
    setSignatureDate,
    setAcceptedBy,
    setContractInitials,
    setPaymentPreference,
    completeIntake,
    setIntakeStep,
    setView,
    resetAll,
    documentOnlyPreview,
    setDocumentOnlyPreview,
    setViewOnly,
  } = useStore();

  const isNewConsigner = currentForm?.consignerType === 'new';

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const signatureRef = useRef<SignatureCanvas>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [showBalloons, setShowBalloons] = useState(false);
  const [formSigned, setFormSigned] = useState(currentForm?.status === 'signed');
  const [expandedPhotos, setExpandedPhotos] = useState<number | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState(currentForm?.consignerEmail || '');
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);

  useEffect(() => {
    checkEmailConfigured().then(setEmailConfigured);
  }, []);

  const hasPaymentInitial = paymentPreference.trim() !== '';

  // Check if form can be completed
  const canComplete = () => {
    const base =
      acceptedBy.trim() !== '' &&
      initials.init1.trim() !== '' &&
      initials.init2.trim() !== '' &&
      initials.init3.trim() !== '' &&
      signatureData !== null &&
      signatureDate !== '';
    if (!isNewConsigner) return base;
    return base && contractInitials.trim() !== '' && !!hasPaymentInitial;
  };

  const getMissingFields = () => {
    const missing = [];
    if (!acceptedBy.trim()) missing.push('staff acceptance');
    if (!initials.init1.trim() || !initials.init2.trim() || !initials.init3.trim()) {
      missing.push('consigner initials');
    }
    if (isNewConsigner && !contractInitials.trim()) missing.push('contract initials');
    if (isNewConsigner && !hasPaymentInitial) missing.push('payment preference');
    if (!signatureData) missing.push('consigner signature');
    if (!signatureDate) missing.push('date');
    return missing;
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureData(null);
  };

  const handleConfirmSignature = () => {
    if (signatureRef.current) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      setSignatureData(dataUrl);
    }
  };

  const handleCompleteIntake = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    const success = await completeIntake();
    setIsCompleting(false);
    if (success) {
      setFormSigned(true);
      setShowBalloons(true);
      setTimeout(() => setShowBalloons(false), 3000);
    }
  };

  const handleBack = () => {
    if (documentOnlyPreview) {
      setDocumentOnlyPreview(false);
      navigate('/admin');
      return;
    }
    if (formSigned) {
      resetAll();
      setView('dashboard');
    } else {
      setIntakeStep('item-entry');
    }
  };

  const handleNewIntake = () => {
    resetAll();
    setView('intake');
  };

  const handleReturnToDashboard = () => {
    setView('dashboard');
  };

  // Generate PDF and return as base64 string
  const showPhotosForCapture = () => {
    const el = documentRef.current?.querySelector('.printable-photos') as HTMLElement | null;
    if (el) el.style.display = 'block';
  };

  const hidePhotosAfterCapture = () => {
    const el = documentRef.current?.querySelector('.printable-photos') as HTMLElement | null;
    if (el) el.style.display = 'none';
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    if (!documentRef.current) return null;

    try {
      showPhotosForCapture();
      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      hidePhotosAfterCapture();

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      // Return as base64 data URL
      return pdf.output('datauristring');
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;

    setIsDownloading(true);
    try {
      showPhotosForCapture();
      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      hidePhotosAfterCapture();

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      const fileName = `intake-${currentForm?.consignerName?.replace(/\s+/g, '-') || 'form'}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      hidePhotosAfterCapture();
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try printing instead.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Filter accepted items
  const acceptedItems = items.filter(item => 
    enabledFields.status ? item.status === 'Accept' : true
  );

  const totalQuantity = acceptedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = acceptedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="animate-in">
      {/* Celebration balloons */}
      {showBalloons && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-8 h-10 rounded-full animate-bounce"
              style={{
                backgroundColor: ['#FF4B4B', '#21C354', '#00D4FF', '#FFBD45'][i % 4],
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                bottom: '-40px',
                animation: `balloon ${3 + Math.random() * 2}s ease-out forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes balloon {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold">
          {documentOnlyPreview ? 'Document Preview' : 'Intake Agreement Preview'}
        </h2>
        <div className="flex gap-2">
          {/* Edit button - show when viewing a form (not in document-only mode) */}
          {!documentOnlyPreview && isViewOnly && (
            <button
              onClick={() => {
                setViewOnly(false);
                setIntakeStep('item-entry');
              }}
              className="st-button"
            >
              <Edit size={18} className="inline mr-2" />
              Edit Form
            </button>
          )}
          <button onClick={handleBack} className="st-button">
            {documentOnlyPreview ? (
              <>
                <X size={18} className="inline mr-2" />
                Close
              </>
            ) : (
              <>
                <ArrowLeft size={18} className="inline mr-2" />
                {formSigned ? 'Close' : 'Back to Item Entry'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="st-divider" />

      {/* PDF-like Preview - this is the printable document */}
      <div ref={documentRef} className="printable-document bg-white text-gray-900 rounded-lg p-6 mb-6 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Consigned By Design</h1>
          <p className="text-gray-500 text-sm">
            7035 East 96th Street, Suite A<br />
            Indianapolis, Indiana 46250
          </p>
        </div>

        {/* Consigner Info */}
        <div className="mb-6 space-y-2">
          <p><strong>Consigner Name:</strong> {currentForm?.consignerName || '________________________'}</p>
          {currentForm?.consignerNumber && (
            <p><strong>Consigner #:</strong> {currentForm.consignerNumber}</p>
          )}
          {currentForm?.consignerAddress && (
            <p>
              <strong>Address:</strong> {currentForm.consignerAddress}
              {(currentForm.consignerCity || currentForm.consignerState || currentForm.consignerZip) && (
                <>, {currentForm.consignerCity}{currentForm.consignerCity && currentForm.consignerState ? ', ' : ''}{currentForm.consignerState}{currentForm.consignerZip ? ' ' + currentForm.consignerZip : ''}</>
              )}
            </p>
          )}
          {currentForm?.consignerPhone && (
            <p><strong>Phone:</strong> {currentForm.consignerPhone}</p>
          )}
        </div>

        <div className="mb-4 space-y-1">
          <p className="text-sm"><strong>Accepted by:</strong> {acceptedBy || '________'}</p>
          <p className="text-sm"><strong>Intake Date:</strong> {signatureDate || '____________'}</p>
        </div>

        {/* Acknowledgment */}
        <div className="my-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            I hereby agree to consign with Consigned by Design (CBD) the items listed here. These items are my personal
            property or items I am authorized to sell. By consigning, I acknowledge, accept, and agree to all the terms
            of the CBD contract. Items listed here are subject to further review before being accepted or maintained for resale.
          </p>
        </div>

        {/* Initials section */}
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-bold w-14 shrink-0">{initials.init1 || '______'}</span>
            <span>I agree to special Holiday terms and the shorter consignment period.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold w-14 shrink-0">{initials.init2 || '______'}</span>
            <span>I have no specific requirements other than those noted below.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold w-14 shrink-0">{initials.init3 || '______'}</span>
            <span>I agree to participate in all sales &amp; promotions of CBD and markdowns will be equally shared as per contract.</span>
          </div>
        </div>

        {/* Contract section — new consigners only */}
        {isNewConsigner && (
          <div className="mb-4 border border-gray-300 rounded-lg p-4">
            <h4 className="font-bold text-sm mb-2">Consignment Contract — Key Terms</h4>
            <ul className="text-xs text-gray-700 space-y-1 mb-3 list-disc list-inside">
              <li>Furniture &amp; other large items must be preapproved by email.</li>
              <li>One-Time $25 Account Registration Fee.</li>
              <li>Pricing request(s) must occur during intake.</li>
              <li>120-day Consignment Period with markdowns.</li>
              <li>Shorter Consignment Period for holiday items.</li>
              <li>Items become CBD property at expiration.</li>
              <li>Cross-Posting / Selling is not permitted.</li>
              <li>We will not contact you for account activity/reminders.</li>
              <li>Twenty-five percent (25%) of original price is charged for reclaim during 120 days of consignment.</li>
              <li>Checks must be picked up &amp; cashed within 180 days of issue/expiration. Expired checks will not be reissued.</li>
            </ul>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-gray-600 italic">Consignor acknowledges receipt and agreement to all contract terms above.</p>
              <div className="text-center shrink-0">
                <div className="w-24 h-8 border-b border-gray-500 flex items-end justify-center pb-1 text-sm font-bold">
                  {contractInitials || ''}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Consignor Initials</p>
              </div>
            </div>
            {/* Payment preference */}
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold mb-2">PAYMENT — please select your preference:</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold w-4">{paymentPreference === 'cash' ? '✓' : '☐'}</span>
                  <span>I would like to maintain cash on account.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold w-4">{paymentPreference === 'pickup' ? '✓' : '☐'}</span>
                  <span>I will pick up my check(s) at the store.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold w-4">{paymentPreference === 'mail' ? '✓' : '☐'}</span>
                  <span>I would like my check(s) mailed (out of state).</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signature line */}
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-4 pb-4 border-b border-gray-200">
          <div>
            <p className="text-sm mb-1">Consigner Signature:</p>
            {signatureData ? (
              <img src={signatureData} alt="Signature" className="h-16 border-b border-gray-400" />
            ) : (
              <div className="w-48 h-16 border-b border-gray-400" />
            )}
          </div>
        </div>

        {/* Items Table */}
        <h3 className="font-bold text-lg mb-4">Item List</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="p-2 text-left border">#</th>
                <th className="p-2 text-left border">Title</th>
                {enabledFields.notes && <th className="p-2 text-left border">Notes</th>}
                {enabledFields.status && <th className="p-2 text-center border">Status</th>}
                {enabledFields.price && <th className="p-2 text-right border">Price</th>}
                {enabledFields.quantity && <th className="p-2 text-center border">QTY</th>}
                {enabledFields.condition && <th className="p-2 text-center border">Cond.</th>}
                {enabledFields.dimensions && <th className="p-2 text-left border">Dims (W×D×H×SH)</th>}
              </tr>
            </thead>
            <tbody>
              {acceptedItems.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 border">{idx + 1}</td>
                  <td className="p-2 border">{item.name.substring(0, 25) || '-'}</td>
                  {enabledFields.notes && <td className="p-2 border">{item.notes.substring(0, 30) || '-'}</td>}
                  {enabledFields.status && <td className="p-2 border text-center">A</td>}
                  {enabledFields.price && <td className="p-2 border text-right">${item.price.toFixed(2)}</td>}
                  {enabledFields.quantity && <td className="p-2 border text-center">{item.quantity}</td>}
                  {enabledFields.condition && <td className="p-2 border text-center">{item.condition.substring(0, 4)}</td>}
                  {enabledFields.dimensions && <td className="p-2 border">{item.dimensions || '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg flex flex-wrap gap-4 justify-center text-sm font-medium">
          <span>{acceptedItems.length} Items</span>
          {enabledFields.quantity && <span>Total Qty: {totalQuantity}</span>}
          {enabledFields.price && <span>Total: ${totalPrice.toFixed(2)}</span>}
        </div>

        {/* Photos — hidden on screen, shown in print/PDF */}
        {acceptedItems.some(item => item.photos.length > 0) && (
          <div className="printable-photos mt-6" style={{ display: 'none' }}>
            <h3 className="font-bold text-base mb-3 border-t border-gray-300 pt-4">Item Photos</h3>
            {acceptedItems.map((item, idx) => {
              if (item.photos.length === 0) return null;
              return (
                <div key={item.id} className="mb-4">
                  <p className="text-sm font-medium mb-2">
                    Item #{idx + 1}: {item.name || 'Unnamed'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {item.photos.map((photo, photoIdx) => (
                      <img
                        key={photoIdx}
                        src={photo}
                        alt={`Item ${idx + 1} photo ${photoIdx + 1}`}
                        style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Photos Section - hidden in document-only mode */}
      {!documentOnlyPreview && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon size={20} />
            Item Photos
          </h3>
          
          {acceptedItems.some(item => item.photos.length > 0) ? (
            <div className="space-y-3">
              {acceptedItems.map((item, idx) => {
                if (item.photos.length === 0) return null;
                
                return (
                  <div key={item.id} className="st-card">
                    <button
                      onClick={() => setExpandedPhotos(expandedPhotos === idx ? null : idx)}
                      className="w-full flex items-center justify-between"
                    >
                      <span className="font-medium">
                        Item #{idx + 1}: {item.name || 'Unnamed'} ({item.photos.length} photo{item.photos.length > 1 ? 's' : ''})
                      </span>
                      <span className="text-text-secondary">{expandedPhotos === idx ? '▼' : '▶'}</span>
                    </button>
                    
                    {expandedPhotos === idx && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {item.photos.map((photo, photoIdx) => (
                          <img
                            key={photoIdx}
                            src={photo}
                            alt={`${item.name} photo ${photoIdx + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border border-surface-border"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="st-caption">No photos attached to items.</p>
          )}
        </div>
      )}

      {!documentOnlyPreview && <div className="st-divider" />}

      {/* E-Signature Section (only for new intakes, hidden in document-only mode) */}
      {!documentOnlyPreview && !isViewOnly && !formSigned && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">E-Signature</h3>
          <p className="text-text-secondary mb-2">
            Please review the agreement above and complete the signature section.
          </p>
          <a
            href="/CBD_%20contract.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline mb-4"
          >
            <FileText size={14} />
            View full CBD Consignment Contract (PDF)
          </a>

          {/* Staff acceptance */}
          <div className="mb-4">
            <label className="st-label">Accepted by (staff)</label>
            <input
              type="text"
              className="st-input max-w-xs"
              value={acceptedBy}
              onChange={(e) => setAcceptedBy(e.target.value)}
              maxLength={30}
              placeholder="Enter staff name"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Logged in as: {currentUser?.name} ({currentUser?.role})
            </p>
          </div>

          <div className="st-divider" />

          {/* Consigner initials — single field applies to all three statements */}
          <p className="font-medium mb-2">Consigner — initial to acknowledge all of the following:</p>
          <ul className="text-sm mb-3 list-disc list-inside space-y-1" style={{ color: 'var(--text-secondary)' }}>
            <li>I agree to special Holiday terms and the shorter consignment period.</li>
            <li>I have no specific requirements other than those noted below.</li>
            <li>I agree to participate in all sales &amp; promotions of CBD and markdowns will be equally shared as per contract.</li>
          </ul>
          <div className="flex items-center gap-4 mb-6">
            <label className="st-label mb-0 shrink-0">Initials</label>
            <input
              type="text"
              className="st-input w-24 text-center"
              value={initials.init1}
              onChange={(e) => {
                const val = e.target.value.toLowerCase();
                setInitials({ init1: val, init2: val, init3: val });
              }}
              maxLength={5}
              placeholder="initials"
            />
          </div>

          {/* Contract section — new consigners only */}
          {isNewConsigner && (
            <div className="mb-6 p-4 border border-surface-border rounded-lg">
              <h4 className="font-semibold mb-3">Consignment Contract</h4>
              <ul className="text-sm space-y-1 mb-4 list-disc list-inside" style={{ color: 'var(--text-secondary)' }}>
                <li>Furniture &amp; other large items must be preapproved by email.</li>
                <li>One-Time $25 Account Registration Fee.</li>
                <li>Pricing request(s) must occur during intake.</li>
                <li>120-day Consignment Period with markdowns.</li>
                <li>Shorter Consignment Period for holiday items.</li>
                <li>Items become CBD property at expiration.</li>
                <li>Cross-Posting / Selling is not permitted.</li>
                <li>We will not contact you for account activity/reminders.</li>
                <li>Twenty-five percent (25%) of original price is charged for reclaim during 120 days of consignment.</li>
                <li>Checks must be picked up &amp; cashed within 180 days of issue/expiration. Expired checks will not be reissued.</li>
              </ul>

              <div className="flex items-center gap-4 mb-4">
                <p className="flex-1 text-sm">I acknowledge receipt and agreement to all contract terms above.</p>
                <input
                  type="text"
                  className="st-input w-20 text-center"
                  value={contractInitials}
                  onChange={(e) => setContractInitials(e.target.value.toLowerCase())}
                  maxLength={5}
                  placeholder="initials"
                />
              </div>

              <div className="st-divider" />

              <p className="font-medium text-sm mb-3">PAYMENT — select your preference:</p>
              <div className="space-y-2">
                {[
                  { value: 'cash', label: 'I would like to maintain cash on account.' },
                  { value: 'pickup', label: 'I will pick up my check(s) at the store.' },
                  { value: 'mail', label: 'I would like my check(s) mailed (out of state).' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentPreference"
                      value={option.value}
                      checked={paymentPreference === option.value}
                      onChange={() => setPaymentPreference(option.value)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div className="mb-6">
            <label className="st-label">Date</label>
            <input
              type="date"
              className="st-input max-w-xs"
              value={signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
            />
          </div>

          {/* Signature pad */}
          <div className="mb-6">
            <label className="st-label">Consigner Signature</label>

            {!signatureData ? (
              <>
                <p className="st-caption mb-2">Use your finger or mouse to sign in the box below</p>
                <div className="bg-white rounded-lg border-2 border-surface-border p-2" style={{ touchAction: 'none' }}>
                  <SignatureCanvas
                    ref={signatureRef}
                    canvasProps={{
                      className: 'signature-canvas w-full h-40 bg-white rounded',
                      style: { touchAction: 'none' },
                    }}
                    penColor="black"
                    clearOnResize={false}
                  />
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={handleClearSignature} className="st-button">
                    Clear
                  </button>
                  <button onClick={handleConfirmSignature} className="st-button-primary">
                    Confirm Signature
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="st-success mb-3">
                  <CheckCircle size={18} className="inline mr-2" />
                  Signature captured!
                </div>
                <img
                  src={signatureData}
                  alt="Signature"
                  className="h-20 border border-surface-border rounded-lg p-2 bg-white"
                />
                <button onClick={handleClearSignature} className="st-button mt-3">
                  Re-sign
                </button>
              </>
            )}
          </div>

          {/* Validation */}
          {!canComplete() && (
            <div className="st-warning mb-4">
              Please provide: {getMissingFields().join(', ')}
            </div>
          )}

          {/* Complete button */}
          <button
            onClick={handleCompleteIntake}
            disabled={!canComplete() || isCompleting}
            className="w-full st-button-primary"
          >
            {isCompleting ? 'Saving...' : 'Complete Intake Agreement'}
          </button>
        </div>
      )}

      {/* View-only signature display - show when viewing or editing a signed form */}
      {!documentOnlyPreview && (isViewOnly || formSigned) && signatureData && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Signature on File</h3>

          <div className="space-y-3">
            <p><strong>Staff Acceptance:</strong> {acceptedBy}</p>

            <div className="flex flex-wrap gap-4">
              <p><strong>Initial 1:</strong> {initials.init1}</p>
              <p><strong>Initial 2:</strong> {initials.init2}</p>
              <p><strong>Initial 3:</strong> {initials.init3}</p>
            </div>

            {isNewConsigner && contractInitials && (
              <div className="flex flex-wrap gap-4">
                <p><strong>Contract Initials:</strong> {contractInitials}</p>
                {paymentPreference && (
                  <p><strong>Payment:</strong> {paymentPreference === 'cash' ? 'Cash on account' : paymentPreference === 'pickup' ? 'Pick up check' : 'Mail check'}</p>
                )}
              </div>
            )}

            <p><strong>Date:</strong> {signatureDate}</p>

            <div>
              <p className="font-medium mb-2">Consigner Signature:</p>
              <img src={signatureData} alt="Signature" className="h-20 border border-surface-border rounded-lg p-2 bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Download/Print/Email buttons - hidden in document-only mode */}
      {!documentOnlyPreview && (
        <div className="space-y-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex-1 st-button"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={18} className="inline mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download size={18} className="inline mr-2" />
                  Download PDF
                </>
              )}
            </button>
            <button
              onClick={() => {
                showPhotosForCapture();
                window.addEventListener('afterprint', hidePhotosAfterCapture, { once: true });
                window.print();
              }}
              className="flex-1 st-button"
            >
              <Printer size={18} className="inline mr-2" />
              Print Form
            </button>
          </div>

          {/* Email Receipt Section */}
          <div className="st-card">
            <button
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2 font-medium">
                <Mail size={18} />
                Email Receipt to Customer
                {emailConfigured && (
                  <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                    Direct Send
                  </span>
                )}
              </span>
              <span className="text-text-secondary">{showEmailForm ? '▼' : '▶'}</span>
            </button>

            {showEmailForm && (
              <div className="mt-4 pt-4 border-t border-surface-border">
                {emailSent ? (
                  <div className="st-success">
                    <CheckCircle size={18} className="inline mr-2" />
                    {emailConfigured
                      ? `Email sent successfully to ${emailAddress}!`
                      : `Email client opened for ${emailAddress}`
                    }
                  </div>
                ) : (
                  <>
                    <label className="st-label">Customer Email Address</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        className="st-input flex-1"
                        placeholder="customer@email.com"
                        value={emailAddress}
                        onChange={(e) => {
                          setEmailAddress(e.target.value);
                          setEmailError('');
                        }}
                      />
                      <button
                        onClick={async () => {
                          if (!emailAddress.trim() || !emailAddress.includes('@')) {
                            setEmailError('Please enter a valid email address');
                            return;
                          }

                          // Build email content
                          const itemsList = acceptedItems
                            .map((item, idx) => `${idx + 1}. ${item.name || 'Unnamed item'}${item.notes ? ` - ${item.notes}` : ''}`)
                            .join('\n');

                          const subject = `Consigned By Design - Intake Receipt for ${currentForm?.consignerName || 'Customer'}`;
                          const body = `Dear ${currentForm?.consignerName || 'Valued Customer'},

Thank you for consigning with Consigned By Design!

This email confirms your intake agreement dated ${signatureDate || new Date().toLocaleDateString()}.

CONSIGNER INFORMATION:
- Name: ${currentForm?.consignerName || 'N/A'}
${currentForm?.consignerNumber ? `- Consigner #: ${currentForm.consignerNumber}` : ''}
${currentForm?.consignerAddress ? `- Address: ${currentForm.consignerAddress.replace(/\n/g, ', ')}` : ''}
${currentForm?.consignerPhone ? `- Phone: ${currentForm.consignerPhone}` : ''}

ITEMS CONSIGNED (${acceptedItems.length} items):
${itemsList}

Total Items: ${acceptedItems.length}
${enabledFields.quantity ? `Total Quantity: ${totalQuantity}` : ''}
${enabledFields.price ? `Total Estimated Value: $${totalPrice.toFixed(2)}` : ''}

ACCEPTED BY: ${acceptedBy || 'Staff'}

If you have any questions, please contact us at:
Consigned By Design
7035 East 96th Street, Suite A
Indianapolis, Indiana 46250

Thank you for choosing Consigned By Design!`;

                          if (emailConfigured) {
                            // Send directly via Gmail SMTP with PDF attachment
                            setEmailSending(true);
                            setEmailError('');

                            // Generate PDF for attachment
                            const pdfBase64 = await generatePDFBase64();
                            const pdfFilename = `intake-${currentForm?.consignerName?.replace(/\s+/g, '-') || 'form'}-${new Date().toISOString().split('T')[0]}.pdf`;

                            if (!pdfBase64) {
                              setEmailSending(false);
                              setEmailError('Failed to generate PDF attachment');
                              return;
                            }

                            const result = await sendEmailWithPDF(
                              {
                                to_email: emailAddress,
                                to_name: currentForm?.consignerName || 'Valued Customer',
                                from_name: 'Consigned By Design',
                                subject: subject,
                                message: body,
                              },
                              pdfBase64,
                              pdfFilename
                            );

                            setEmailSending(false);

                            if (result.success) {
                              setEmailSent(true);
                            } else {
                              setEmailError(result.error || 'Failed to send email');
                            }
                          } else {
                            // Fallback to mailto
                            const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            window.open(mailtoUrl, '_blank');
                            setEmailSent(true);
                          }
                        }}
                        disabled={!emailAddress.trim() || emailSending}
                        className="st-button-primary"
                      >
                        {emailSending ? (
                          <>
                            <Loader2 size={18} className="inline mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send size={18} className="inline mr-2" />
                            {emailConfigured ? 'Send Email' : 'Open Email'}
                          </>
                        )}
                      </button>
                    </div>

                    {emailError && (
                      <p className="text-sm text-error mt-2">{emailError}</p>
                    )}

                    <p className="st-caption mt-2">
                      {emailConfigured
                        ? 'Email will be sent with the intake form attached as a PDF.'
                        : 'Opens your email client with a pre-filled receipt.'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success actions (after signing in this session) - hidden in document-only mode */}
      {!documentOnlyPreview && formSigned && !isViewOnly && (
        <div className="space-y-3">
          <div className="st-success">
            <CheckCircle size={20} className="inline mr-2" />
            Intake Agreement signed and saved!
          </div>

          <button onClick={handleNewIntake} className="w-full st-button-primary">
            <FileText size={18} className="inline mr-2" />
            Start New Intake
          </button>

          <button onClick={handleReturnToDashboard} className="w-full st-button">
            <Home size={18} className="inline mr-2" />
            Return to Dashboard
          </button>
        </div>
      )}

      {/* View-only actions - for viewing signed forms */}
      {!documentOnlyPreview && isViewOnly && (
        <div className="space-y-3">
          <button onClick={handleReturnToDashboard} className="w-full st-button">
            <Home size={18} className="inline mr-2" />
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

