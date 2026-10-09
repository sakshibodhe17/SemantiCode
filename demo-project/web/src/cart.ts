// Shopping-cart state used by the storefront UI.

export interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export class Cart {
  private items: CartItem[] = [];

  addItem(item: CartItem): void {
    const existing = this.items.find((i) => i.sku === item.sku);
    if (existing) existing.quantity += item.quantity;
    else this.items.push({ ...item });
  }

  removeItem(sku: string): void {
    this.items = this.items.filter((i) => i.sku !== sku);
  }

  /** Total price of everything in the cart, including delivery charge. */
  getTotal(deliveryFee = 49): number {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return subtotal >= 999 ? subtotal : subtotal + deliveryFee;
  }
}

export function formatPrice(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}
