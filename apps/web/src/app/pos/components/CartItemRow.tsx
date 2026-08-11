import React from 'react';
import { Plus, Minus, Trash2, Tag } from 'lucide-react';
import { localizedName, useLanguageStore } from '../../../stores/languageStore';

interface CartItemRowProps {
  item: {
    productId: string;
    name: string;
    nameAr?: string;
    price: number;
    quantity: number;
    sku?: string;
    taxRate?: any;
  };
  currency: string;
  isHighlighted?: boolean;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onUpdatePrice: (productId: string, price: number) => void;
  onRemoveItem: (productId: string) => void;
  onTryAddMore?: () => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  currency,
  isHighlighted = false,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  onTryAddMore,
}) => {
  const { t } = useLanguageStore();
  const rawRate = item.taxRate?.rate ?? item.taxRate ?? 15;
  const taxRate = Number(rawRate) || 15;
  const taxMultiplier = 1 + (taxRate / 100);
  const displayPrice = item.price === 0 ? '' : Math.round(item.price * taxMultiplier * 100) / 100;
  const lineSubtotal = ((item.price * taxMultiplier) * item.quantity).toFixed(2);

  return (
    <div
      className={`rounded-xl p-2.5 flex items-center justify-between gap-2.5 transition-all duration-300 border shadow-xs ${
        isHighlighted
          ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30 scale-[1.005]'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Item info */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 font-black text-[13px] flex items-center justify-center shrink-0 border border-cyan-100 shadow-2xs">
          {item.name.charAt(0).toUpperCase()}
        </div>
        <div className="truncate">
          <h4 className="text-[13px] font-extrabold text-slate-900 truncate">
            {localizedName(item.name, item.nameAr)}
          </h4>
          {item.sku && (
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <Tag className="w-3 h-3 text-slate-300" />
              {item.sku}
            </span>
          )}
        </div>
      </div>

      {/* Unit Price Editor */}
      <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
        <span className="text-[11px] text-slate-400 font-medium">{currency}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={displayPrice}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            onUpdatePrice(item.productId, isNaN(val) ? 0 : val / taxMultiplier);
          }}
          className="w-14 bg-white border border-slate-200 rounded-md px-1 py-0.5 text-center font-extrabold text-slate-800 text-[11px] focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title={t.priceEditTitle}
        />
      </div>

      {/* Quantity Stepper Controls */}
      <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-200">
        <button
          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="number"
          min="1"
          step="1"
          value={item.quantity === 0 ? '' : item.quantity}
          onChange={(e) => onUpdateQuantity(item.productId, parseInt(e.target.value, 10) || 0)}
          className="text-xs font-black w-7 text-center text-slate-900 bg-transparent focus:bg-white focus:outline-none rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => {
            if (onTryAddMore) {
              onTryAddMore();
            } else {
              onUpdateQuantity(item.productId, item.quantity + 1);
            }
          }}
          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Line Subtotal */}
      <div className="text-end min-w-[80px]">
        <span className="text-[10px] text-slate-400 block -mb-0.5">{t.lineTotal}</span>
        <span className="text-[13px] font-black text-cyan-600">
          {currency} {lineSubtotal}
        </span>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemoveItem(item.productId)}
        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        title={t.deleteItem}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
