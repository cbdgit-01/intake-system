import { useStore } from '../store/useStore';

export default function PrintableItemsList() {
  const { currentForm, items, enabledFields } = useStore();

  const displayItems = enabledFields.status
    ? items.filter(item => item.status === 'Accept')
    : items;

  const totalQuantity = displayItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = displayItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="printable-items-list" style={{ display: 'none' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>
          Consigned By Design
        </h1>
        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
          7035 East 96th Street, Suite A — Indianapolis, Indiana 46250
        </p>
      </div>

      {/* Consigner info */}
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <p style={{ margin: '2px 0' }}>
          <strong>Consigner:</strong> {currentForm?.consignerName || '—'}
        </p>
        {currentForm?.consignerNumber && (
          <p style={{ margin: '2px 0' }}>
            <strong>Consigner #:</strong> {currentForm.consignerNumber}
          </p>
        )}
        <p style={{ margin: '2px 0' }}>
          <strong>Date:</strong> {new Date().toLocaleDateString()}
        </p>
        <p style={{ margin: '2px 0' }}>
          <strong>Items:</strong> {displayItems.length}
        </p>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#333', color: '#fff' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ccc' }}>#</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Title</th>
            {enabledFields.notes && (
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Notes</th>
            )}
            {enabledFields.status && (
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ccc' }}>Status</th>
            )}
            {enabledFields.price && (
              <th style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #ccc' }}>Price</th>
            )}
            {enabledFields.quantity && (
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ccc' }}>QTY</th>
            )}
            {enabledFields.condition && (
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ccc' }}>Cond.</th>
            )}
            {enabledFields.dimensions && (
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Dims</th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, idx) => (
            <tr
              key={item.id}
              style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}
            >
              <td style={{ padding: '6px 8px', border: '1px solid #ccc' }}>{idx + 1}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #ccc' }}>{item.name || '—'}</td>
              {enabledFields.notes && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc' }}>{item.notes || '—'}</td>
              )}
              {enabledFields.status && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>
                  {item.status === 'Accept' ? 'A' : 'D'}
                </td>
              )}
              {enabledFields.price && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'right' }}>
                  ${item.price.toFixed(2)}
                </td>
              )}
              {enabledFields.quantity && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>
                  {item.quantity}
                </td>
              )}
              {enabledFields.condition && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'center' }}>
                  {item.condition || '—'}
                </td>
              )}
              {enabledFields.dimensions && (
                <td style={{ padding: '6px 8px', border: '1px solid #ccc' }}>
                  {item.dimensions || '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f0f0f0', fontSize: '13px', display: 'flex', gap: '24px' }}>
        <span><strong>Total Items:</strong> {displayItems.length}</span>
        {enabledFields.quantity && (
          <span><strong>Total Qty:</strong> {totalQuantity}</span>
        )}
        {enabledFields.price && (
          <span><strong>Total Value:</strong> ${totalPrice.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
