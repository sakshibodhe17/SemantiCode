package shop;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.util.HexFormat;

/** Talks to the card payment gateway: charges, refunds and webhooks. */
public class PaymentService {
    private final GatewayClient gateway;
    private final String webhookSecret;

    public PaymentService(GatewayClient gateway, String webhookSecret) {
        this.gateway = gateway;
        this.webhookSecret = webhookSecret;
    }

    /** Charge the customer's card for an order. */
    public Receipt chargeCard(String orderId, String cardToken, BigDecimal amount) {
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        return gateway.charge(cardToken, amount, "order-" + orderId);
    }

    /** Refund all or part of a previous payment. */
    public Receipt refundPayment(String paymentId, BigDecimal amount) {
        Receipt original = gateway.find(paymentId);
        if (amount.compareTo(original.amount()) > 0) {
            throw new IllegalStateException("cannot refund more than was paid");
        }
        return gateway.refund(paymentId, amount);
    }

    /** Verify the HMAC signature the gateway attaches to webhook calls. */
    public boolean verifyWebhookSignature(String payload, String signatureHex) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(webhookSecret.getBytes(), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal(payload.getBytes()));
        return expected.equalsIgnoreCase(signatureHex);
    }
}
