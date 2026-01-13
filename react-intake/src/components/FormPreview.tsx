import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { ArrowLeft, Download, Printer, CheckCircle, Home, FileText, ImageIcon, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../store/useAuth';

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
    setSignatureData,
    setInitials,
    setSignatureDate,
    setAcceptedBy,
    completeIntake,
    saveCurrentForm,
    setIntakeStep,
    setView,
    resetAll,
    documentOnlyPreview,
    setDocumentOnlyPreview,
  } = useStore();

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const signatureRef = useRef<SignatureCanvas>(null);
  const [showBalloons, setShowBalloons] = useState(false);
  const [formSigned, setFormSigned] = useState(currentForm?.status === 'signed');
  const [expandedPhotos, setExpandedPhotos] = useState<number | null>(null);

  // Check if form can be completed
  const canComplete = () => {
    return (
      acceptedBy.trim() !== '' &&
      initials.init1.trim() !== '' &&
      initials.init2.trim() !== '' &&
      initials.init3.trim() !== '' &&
      signatureData !== null &&
      signatureDate !== ''
    );
  };

  const getMissingFields = () => {
    const missing = [];
    if (!acceptedBy.trim()) missing.push('staff acceptance');
    if (!initials.init1.trim() || !initials.init2.trim() || !initials.init3.trim()) {
      missing.push('consigner initials');
    }
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
    const success = await completeIntake();
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

  const handleSaveChanges = async () => {
    await saveCurrentForm();
    setView('dashboard');
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

      <div className="st-divider" />

      {/* PDF-like Preview */}
      <div className="bg-white text-gray-900 rounded-lg p-6 mb-6 shadow-lg">
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
            <p><strong>Address:</strong> {currentForm.consignerAddress.replace(/\n/g, ', ')}</p>
          )}
          {currentForm?.consignerPhone && (
            <p><strong>Phone:</strong> {currentForm.consignerPhone}</p>
          )}
        </div>

        <p className="text-sm"><strong>Accepted by:</strong> {acceptedBy || '________'}</p>

        {/* Acknowledgment */}
        <div className="my-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            I hereby agree to consign the items listed below with Consigned By Design.
            I understand and accept the terms and conditions of the consignment agreement.
          </p>
        </div>

        {/* Initials section */}
        <div className="mb-6 space-y-2 text-sm">
          <p>I have reviewed and agree to the items listed. <strong>Initials: {initials.init1 || '______'}</strong></p>
          <p>I understand and accept the consignment terms. <strong>Initials: {initials.init2 || '______'}</strong></p>
          <p>I confirm all item information is accurate. <strong>Initials: {initials.init3 || '______'}</strong></p>
        </div>

        {/* Signature line */}
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-6 pb-6 border-b border-gray-200">
          <div>
            <p className="text-sm mb-1">Consigner Signature:</p>
            {signatureData ? (
              <img src={signatureData} alt="Signature" className="h-16 border-b border-gray-400" />
            ) : (
              <div className="w-48 h-16 border-b border-gray-400" />
            )}
          </div>
          <p className="text-sm"><strong>Date:</strong> {signatureDate || '____________'}</p>
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
                {enabledFields.dimensions && <th className="p-2 text-left border">Dims</th>}
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
                  {enabledFields.dimensions && <td className="p-2 border">{item.dimensions.substring(0, 12) || '-'}</td>}
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
          <p className="text-text-secondary mb-4">
            Please review the agreement above and complete the signature section.
          </p>

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

          {/* Consigner initials */}
          <p className="font-medium mb-3">Consigner - Please initial each statement:</p>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-4">
              <p className="flex-1 text-sm">I have reviewed and agree to the items listed above.</p>
              <input
                type="text"
                className="st-input w-20 text-center"
                value={initials.init1}
                onChange={(e) => setInitials({ init1: e.target.value })}
                maxLength={5}
                placeholder="XX"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <p className="flex-1 text-sm">I understand and accept the consignment terms and conditions.</p>
              <input
                type="text"
                className="st-input w-20 text-center"
                value={initials.init2}
                onChange={(e) => setInitials({ init2: e.target.value })}
                maxLength={5}
                placeholder="XX"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <p className="flex-1 text-sm">I confirm all item information is accurate to the best of my knowledge.</p>
              <input
                type="text"
                className="st-input w-20 text-center"
                value={initials.init3}
                onChange={(e) => setInitials({ init3: e.target.value })}
                maxLength={5}
                placeholder="XX"
              />
            </div>
          </div>

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
            <p className="st-caption mb-2">Use your finger or mouse to sign in the box below</p>
            
            <div className="bg-white rounded-lg border-2 border-surface-border p-2">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'signature-canvas w-full h-40 bg-white rounded',
                }}
                penColor="black"
              />
            </div>
            
            <div className="flex gap-3 mt-3">
              <button onClick={handleClearSignature} className="st-button">
                Clear Signature
              </button>
              <button onClick={handleConfirmSignature} className="st-button-primary">
                Confirm Signature
              </button>
            </div>
            
            {signatureData && (
              <div className="st-success mt-3">
                <CheckCircle size={18} className="inline mr-2" />
                Signature captured!
              </div>
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
            disabled={!canComplete()}
            className="w-full st-button-primary"
          >
            Complete Intake Agreement
          </button>
        </div>
      )}

      {/* View-only signature display - hidden in document-only mode */}
      {!documentOnlyPreview && (isViewOnly || formSigned) && signatureData && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Signature on File</h3>
          
          <div className="space-y-3">
            <p><strong>Staff Acceptance:</strong> {acceptedBy}</p>
            
            <div className="flex gap-8">
              <p><strong>Statement 1:</strong> {initials.init1}</p>
              <p><strong>Statement 2:</strong> {initials.init2}</p>
              <p><strong>Statement 3:</strong> {initials.init3}</p>
            </div>
            
            <p><strong>Date:</strong> {signatureDate}</p>
            
            <div>
              <p className="font-medium mb-2">Consigner Signature:</p>
              <img src={signatureData} alt="Signature" className="h-20 border border-surface-border rounded-lg p-2 bg-white" />
            </div>
          </div>

          <div className="st-divider" />
          
          <div className="st-info">
            This agreement has been signed and cannot be modified.
          </div>
        </div>
      )}

      {/* Download/Print buttons - hidden in document-only mode */}
      {!documentOnlyPreview && (
        <div className="flex gap-3 mb-6">
          <button className="flex-1 st-button">
            <Download size={18} className="inline mr-2" />
            Download PDF
          </button>
          <button onClick={() => window.print()} className="flex-1 st-button">
            <Printer size={18} className="inline mr-2" />
            Print Form
          </button>
        </div>
      )}

      {/* Success actions (after signing) - hidden in document-only mode */}
      {!documentOnlyPreview && formSigned && (
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

      {/* Edit mode save - hidden in document-only mode */}
      {!documentOnlyPreview && !formSigned && isViewOnly && (
        <button onClick={handleSaveChanges} className="w-full st-button-primary">
          Save Changes
        </button>
      )}
    </div>
  );
}

