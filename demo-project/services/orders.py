"""Order placement, stock reservation and customer notifications."""
import smtplib
from email.message import EmailMessage

LOW_STOCK_THRESHOLD = 5


class OutOfStockError(Exception):
    """Raised when an order asks for more items than are available."""


class Inventory:
    def __init__(self):
        self.stock: dict[str, int] = {}

    def reserve(self, sku: str, quantity: int) -> None:
        """Decrease stock for an order, failing if not enough is left."""
        available = self.stock.get(sku, 0)
        if quantity > available:
            raise OutOfStockError(f"only {available} of {sku} left")
        self.stock[sku] = available - quantity

    def low_stock_items(self) -> list[str]:
        return [sku for sku, qty in self.stock.items() if qty < LOW_STOCK_THRESHOLD]


def calculate_order_total(items: list[dict], tax_rate: float = 0.18, coupon: str | None = None) -> float:
    """Sum line items, apply an optional coupon discount, then add GST/tax."""
    subtotal = sum(i["price"] * i["quantity"] for i in items)
    if coupon == "WELCOME10":
        subtotal *= 0.9
    return round(subtotal * (1 + tax_rate), 2)


def send_shipping_email(to_address: str, order_id: int, tracking_number: str) -> None:
    """Email the customer when their order has been shipped."""
    msg = EmailMessage()
    msg["Subject"] = f"Order #{order_id} has shipped"
    msg["To"] = to_address
    msg.set_content(f"Track your parcel with number {tracking_number}.")
    with smtplib.SMTP("localhost") as smtp:
        smtp.send_message(msg)


def place_order(inventory: Inventory, items: list[dict], customer_email: str) -> dict:
    for item in items:
        inventory.reserve(item["sku"], item["quantity"])
    total = calculate_order_total(items)
    return {"status": "confirmed", "total": total, "email": customer_email}
