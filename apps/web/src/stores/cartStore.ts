import { create } from 'zustand';

export interface CartItem {
  productId: string;
  variantId?: string;
  unitId?: string;
  unitName?: string;
  /** Base units contained in one selling unit (carton of 12 → 12). */
  unitFactor: number;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  taxRate?: number;
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone?: string | null;
}

export interface CartSnapshot {
  items: CartItem[];
  customer: CustomerInfo | null;
  discount: number;
  discountType: 'percent' | 'fixed';
}

interface CartState {
  items: CartItem[];
  customer: CustomerInfo | null;
  discount: number; // percentage or fixed
  discountType: 'percent' | 'fixed';
  addItem: (
    product: { id: string; name: string; price: number; sku?: string; taxRate?: any },
    unit?: { unitId?: string; unitName?: string; unitFactor?: number; price?: number },
  ) => void;
  removeItem: (productId: string, unitId?: string) => void;
  updateQuantity: (productId: string, quantity: number, unitId?: string) => void;
  updatePrice: (productId: string, price: number, unitId?: string) => void;
  setDiscount: (amount: number, type: 'percent' | 'fixed') => void;
  setCustomer: (customer: CustomerInfo | null) => void;
  clearCart: () => void;
  restoreCart: (snapshot: CartSnapshot) => void;
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
}

const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// Mirrors the server's discount allocation so client totals always reconcile
// with the authoritative server-side computation.
function allocateDiscount(lineSubtotals: number[], totalDiscount: number): number[] {
  if (totalDiscount <= 0) return lineSubtotals.map(() => 0);
  const total = lineSubtotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return lineSubtotals.map(() => 0);
  let remaining = totalDiscount;
  const out = lineSubtotals.map((sub) => {
    const share = roundCents(totalDiscount * (sub / total));
    remaining = roundCents(remaining - share);
    return share;
  });
  if (remaining !== 0) {
    let largest = 0;
    for (let i = 1; i < lineSubtotals.length; i++) if (lineSubtotals[i] > lineSubtotals[largest]) largest = i;
    out[largest] = roundCents(out[largest] + remaining);
  }
  return out;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  discount: 0,
  discountType: 'percent',

  setCustomer: (customer) => set({ customer }),

  addItem: (product, unit) => {
    set((state) => {
      const unitKey = unit?.unitId ?? null;
      // Same product sold in a different unit (piece vs carton) is a
      // separate line: match on productId AND unitId.
      const existing = state.items.find(
        (item) => item.productId === product.id && (item.unitId ?? null) === unitKey,
      );
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id && (item.unitId ?? null) === unitKey
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: unit?.price != null ? Number(unit.price) : Number(product.price),
            unitId: unit?.unitId,
            unitName: unit?.unitName,
            unitFactor: unit?.unitFactor ?? 1,
            quantity: 1,
            sku: product.sku,
            taxRate: Number(product.taxRate?.rate ?? product.taxRate ?? 15),
          },
        ],
      };
    });
  },

  removeItem: (productId, unitId) => {
    set((state) => ({
      items: state.items.filter(
        (item) => !(item.productId === productId && (item.unitId ?? null) === (unitId ?? null)),
      ),
    }));
  },

  updateQuantity: (productId, quantity, unitId) => {
    if (quantity <= 0) {
      get().removeItem(productId, unitId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId && (item.unitId ?? null) === (unitId ?? null)
          ? { ...item, quantity }
          : item,
      ),
    }));
  },

  updatePrice: (productId, price, unitId) => {
    if (price < 0) return;
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId && (item.unitId ?? null) === (unitId ?? null)
          ? { ...item, price }
          : item,
      ),
    }));
  },

  setDiscount: (amount, type) => {
    set({ discount: amount, discountType: type });
  },

  clearCart: () => {
    set({ items: [], discount: 0, customer: null });
  },

  restoreCart: (snapshot) => {
    set({
      // Older snapshots predate selling units — default their factor.
      items: (snapshot.items || []).map((item) => ({ ...item, unitFactor: item.unitFactor ?? 1 })),
      customer: snapshot.customer,
      discount: snapshot.discount,
      discountType: snapshot.discountType,
    });
  },

  getSubtotal: () => {
    return roundCents(get().items.reduce((sum, item) => {
      const rate = Number(item.taxRate ?? 15);
      return sum + roundCents(item.price * item.quantity * 100 / (100 + rate));
    }, 0));
  },

  getDiscountAmount: () => {
    const grossTotal = roundCents(get().items.reduce((sum, item) => sum + roundCents(item.price * item.quantity), 0));
    const { discount, discountType } = get();
    if (discountType === 'percent') {
      return roundCents((grossTotal * discount) / 100);
    }
    return Math.min(roundCents(discount), grossTotal);
  },

  getTaxAmount: () => {
    return roundCents(get().items.reduce((sum, item) => {
      const rate = Number(item.taxRate ?? 15);
      return sum + roundCents(item.price * item.quantity * rate / (100 + rate));
    }, 0));
  },

  getTotal: () => {
    return roundCents(get().getSubtotal() + get().getTaxAmount() - get().getDiscountAmount());
  },
}));
