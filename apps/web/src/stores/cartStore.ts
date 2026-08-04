import { create } from 'zustand';

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  nameAr?: string;
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

interface CartState {
  items: CartItem[];
  customer: CustomerInfo | null;
  discount: number; // percentage or fixed
  discountType: 'percent' | 'fixed';
  addItem: (product: { id: string; name: string; nameAr?: string; price: number; sku?: string; taxRate?: any }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number, type: 'percent' | 'fixed') => void;
  setCustomer: (customer: CustomerInfo | null) => void;
  clearCart: () => void;
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

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            nameAr: product.nameAr,
            price: Number(product.price),
            quantity: 1,
            sku: product.sku,
            taxRate: Number(product.taxRate?.rate ?? product.taxRate ?? 15),
          },
        ],
      };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      ),
    }));
  },

  setDiscount: (amount, type) => {
    set({ discount: amount, discountType: type });
  },

  clearCart: () => {
    set({ items: [], discount: 0, customer: null });
  },

  getSubtotal: () => {
    return roundCents(get().items.reduce((sum, item) => sum + roundCents(item.price * item.quantity), 0));
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const { discount, discountType } = get();
    if (discountType === 'percent') {
      return roundCents((subtotal * discount) / 100);
    }
    return Math.min(roundCents(discount), subtotal);
  },

  getTaxAmount: () => {
    const lines = get().items.map((item) => ({
      subtotal: roundCents(item.price * item.quantity),
      rate: Number(item.taxRate ?? 15),
    }));
    const lineSubtotals = lines.map((l) => l.subtotal);
    const lineDiscounts = allocateDiscount(lineSubtotals, get().getDiscountAmount());
    return roundCents(
      lines.reduce(
        (sum, l, i) => sum + roundCents((roundCents(l.subtotal - lineDiscounts[i]) * l.rate) / 100),
        0
      )
    );
  },

  getTotal: () => {
    return roundCents(get().getSubtotal() - get().getDiscountAmount() + get().getTaxAmount());
  },
}));
