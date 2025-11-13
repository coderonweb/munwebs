import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    US_STORE_DOMAIN,
    US_ACCESS_TOKEN,
    UK_STORE_DOMAIN,
    UK_ACCESS_TOKEN
  } = process.env;

  const order = req.body;
  console.log(`🛒 New US order received: #${order.name}`);

  try {
    for (const item of order.line_items) {
      const variantId = item.variant_id;

      // 1️⃣ Check inventory in US store
      const variantRes = await axios.get(
        `https://${US_STORE_DOMAIN}/admin/api/2025-01/variants/${variantId}.json`,
        { headers: { "X-Shopify-Access-Token": US_ACCESS_TOKEN } }
      );
      const qty = variantRes.data.variant.inventory_quantity;

      console.log(`🔍 ${item.title}: ${qty} in stock (US)`);

      // 2️⃣ If out of stock → create order in UK store
      if (qty <= 0) {
        console.log(`⚠️ ${item.title} is out of stock. Creating UK order...`);

        const ukOrderData = {
          order: {
            line_items: [
              {
                title: item.title,
                quantity: item.quantity,
                sku: item.sku
              }
            ],
            email: order.email,
            shipping_address: order.shipping_address,
            billing_address: order.billing_address,
            note: `Auto-created from US store order #${order.name}`
          }
        };

        const ukRes = await axios.post(
          `https://${UK_STORE_DOMAIN}/admin/api/2025-01/orders.json`,
          ukOrderData,
          { headers: { "X-Shopify-Access-Token": UK_ACCESS_TOKEN } }
        );

        console.log("✅ Created order in UK store:", ukRes.data.order.id);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}
