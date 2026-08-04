import React, { forwardRef } from 'react';
import { useCartStore } from '../../../stores/cartStore';
import { useLanguageStore, translate, localizedName, paymentMethodLabel } from '../../../stores/languageStore';
import { ZatcaQr } from './ZatcaQr';

interface ReceiptContentProps {
  orderNumber: string;
  cashierName: string;
  paymentMethod: string;
  amountPaid: number;
  storeSettings?: any;
}

export const ReceiptContent = forwardRef<HTMLDivElement, ReceiptContentProps>(
  ({ orderNumber, cashierName, paymentMethod, amountPaid, storeSettings }, ref) => {
    const { items, getSubtotal, getTaxAmount, getTotal } = useCartStore();
    const { t } = useLanguageStore();
    const date = new Date().toLocaleString();

    return (
      <div
        ref={ref}
        className="w-[300px] p-4 bg-white text-black font-mono text-sm leading-tight mx-auto"
        style={{
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
        }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="font-bold text-xl uppercase mb-1 tracking-widest">{storeSettings?.storeName || 'KODASOFT'}</h1>
          <p className="text-xs">{t.enterprisePos}</p>
          <p className="text-xs">{t.taxRegistration} {storeSettings?.vatNumber || storeSettings?.taxId || 'N/A'}</p>
          <div className="border-b border-dashed border-gray-400 my-2"></div>
        </div>

        {/* Order Details */}
        <div className="mb-4 text-xs">
          <div className="flex justify-between">
            <span>{t.orderNumber}</span>
            <span className="font-bold">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.date}</span>
            <span>{date}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.cashierLabel}</span>
            <span>{cashierName}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-gray-400 mb-2"></div>

        {/* Items */}
        <table className="w-full text-xs text-left mb-4">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="py-1">{t.itemCol}</th>
              <th className="py-1 text-center">{t.qtyCol}</th>
              <th className="py-1 text-right">{t.totalCol}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="align-top">
                <td className="py-1 pr-2 max-w-[120px] break-words">
                  {localizedName(item.name, item.nameAr)}
                  <div className="text-[10px] text-gray-500">{t.currency} {item.price.toFixed(2)} {t.eachUnit}</div>
                </td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right">{t.currency} {(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-b border-dashed border-gray-400 mb-2"></div>

        {/* Totals */}
        <div className="space-y-1 text-xs mb-4">
          <div className="flex justify-between">
            <span>{t.subtotalCol}</span>
            <span>{t.currency} {getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.vatCol}</span>
            <span>{t.currency} {getTaxAmount().toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300 mt-1">
            <span>{t.totalColValue}</span>
            <span>{t.currency} {getTotal().toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="text-xs mb-6 space-y-1">
          <div className="flex justify-between">
            <span>{translate(t.paidBy, { method: paymentMethodLabel(paymentMethod) })}</span>
            <span>{t.currency} {amountPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>{t.change}</span>
            <span>{t.currency} {(amountPaid - getTotal()).toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs space-y-1">
          <p className="font-bold">{storeSettings?.receiptFooter || t.thankYou}</p>
          <p>{t.keepReceipt}</p>
          <div className="flex justify-center mt-3">
            <ZatcaQr
              sellerName={storeSettings?.storeName || 'KODASOFT'}
              vatNumber={storeSettings?.vatNumber || storeSettings?.taxId || 'N/A'}
              timestamp={new Date()}
              total={getTotal()}
              vat={getTaxAmount()}
              size={88}
            />
          </div>
          <svg className="w-full h-12 mt-3" xmlns="http://www.w3.org/2000/svg">
             {/* Fake Barcode representation for aesthetic */}
             <rect x="10%" y="10" width="80%" height="20" fill="#000" />
             <rect x="10%" y="32" width="2" height="15" fill="#000" />
             <rect x="12%" y="32" width="1" height="15" fill="#000" />
             <rect x="88%" y="32" width="2" height="15" fill="#000" />
             <text x="50%" y="45" fontSize="10" textAnchor="middle" fill="#000">{orderNumber}</text>
          </svg>
        </div>
      </div>
    );
  }
);
