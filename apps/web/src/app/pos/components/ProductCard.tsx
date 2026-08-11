import React from 'react';
import { Plus, Package, AlertCircle } from 'lucide-react';
import { localizedName, translate, useLanguageStore } from '../../../stores/languageStore';

interface Product {
  id: string;
  name: string;
  nameAr?: string;
  price: number;
  sku?: string;
  barcode?: string;
  taxRate?: any;
  category?: { name: string; nameAr?: string };
  trackInventory?: boolean;
}

interface ProductCardProps {
  product: Product;
  currency: string;
  stock: number | null;
  onSelect: (product: Product) => void;
  viewMode?: 'grid' | 'list';
  skuPrefixLabel?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  stock,
  onSelect,
  viewMode = 'grid',
  skuPrefixLabel = 'SKU',
}) => {
  const { t } = useLanguageStore();
  const isOutOfStock = stock !== null && stock <= 0;
  const isLowStock = stock !== null && stock > 0 && stock <= 5;
  const taxPercent = Number(product.taxRate?.rate ?? 15);
  const finalPrice = (Number(product.price) * (1 + taxPercent / 100)).toFixed(2);

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => !isOutOfStock && onSelect(product)}
        className={`group bg-white hover:bg-cyan-50/60 border border-slate-200 hover:border-cyan-400 rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer shadow-sm ${
          isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-black text-sm shrink-0">
            {product.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-xs text-slate-800 group-hover:text-cyan-600 transition-colors">
                {localizedName(product.name, product.nameAr)}
              </h4>
              {product.category && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                  {localizedName(product.category.name, product.category.nameAr)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 font-mono">
              {(product.sku || product.barcode) && (
                <span>{product.barcode || product.sku}</span>
              )}
              {stock !== null && (
                <span
                  className={`font-semibold ${
                    isOutOfStock
                      ? 'text-rose-500'
                      : isLowStock
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {isOutOfStock ? t.outOfStock : translate(t.stockLeft, { stock })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="text-sm font-extrabold text-cyan-600">
              {currency} {finalPrice}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">{t.taxIncluded}</div>
          </div>
          <button
            disabled={isOutOfStock}
            className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 group-hover:bg-cyan-500 group-hover:text-white flex items-center justify-center transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !isOutOfStock && onSelect(product)}
      className={`group bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-cyan-400 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'active:scale-[0.98]'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg truncate max-w-[120px]">
            {product.category ? localizedName(product.category.name, product.category.nameAr) : t.generalLabel}
          </span>
          {stock !== null && (
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 ${
                isOutOfStock
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : isLowStock
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isOutOfStock ? (
                <>
                  <AlertCircle className="w-3 h-3 inline" /> 0
                </>
              ) : (
                <>
                  <Package className="w-3 h-3 inline" /> {stock}
                </>
              )}
            </span>
          )}
        </div>

        <h3 className="font-extrabold text-xs text-slate-800 group-hover:text-cyan-600 transition-colors line-clamp-2 leading-snug">
          {localizedName(product.name, product.nameAr)}
        </h3>

        {(product.sku || product.barcode) && (
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            {skuPrefixLabel} {product.barcode || product.sku}
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
        <div>
          <span className="text-[10px] text-slate-400 block -mb-0.5">{currency}</span>
          <span className="text-base font-extrabold text-cyan-600 tracking-tight">
            {finalPrice}
          </span>
        </div>
        <span className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-sm">
          <Plus className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
};
