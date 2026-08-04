import React from 'react';
import QRCode from 'react-qr-code';
import { zatcaQrBase64, ZatcaQrInput } from '../../../lib/zatca';

interface ZatcaQrProps extends ZatcaQrInput {
  size?: number;
}

export const ZatcaQr: React.FC<ZatcaQrProps> = ({ sellerName, vatNumber, timestamp, total, vat, size = 64 }) => {
  const value = zatcaQrBase64({ sellerName, vatNumber, timestamp, total, vat });
  return (
    <div
      className="inline-block bg-white p-1 rounded"
      style={{ lineHeight: 0 }}
      title="ZATCA QR"
    >
      <QRCode value={value} size={size} />
    </div>
  );
};
