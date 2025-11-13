import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    US_STORE_DOMAIN,
    US_ACCESS_TOKEN,
    UK_STORE_DOMAIN,
    UK_ACCESS_TOKEN
  } = process.env;

  try {
    const inventoryData = req.body;
    const variantId = inventoryData.admin_graphql_api_id?.split("/").pop();

    if (!variantId) return res.status(400).json({ error: "Variant ID missing" });

    // 1️⃣ Fetch US variant info
    const variantRes = await axios.get(
      `https://${US_STORE_DOMAIN}/admin/api/2025-01/variants/${variantId}.json`,
      { headers: { "X-Shopify-Access-Token": US_ACCESS_TOKEN } }
    );
    const { sku, inventory_quantity } = variantRes.data.variant;

    console.log(`🔄 SKU ${sku}: ${inventory_quantity} in stock (US)`);

    // 2️⃣ Find matching UK variant
    const ukVariants = await axios.get(
      `https://${UK_STORE_DOMAIN}/admin/api/2025-01/variants.json?sku=${sku}`,
      { headers: { "X-Shopify-Access-Token": UK_ACCESS_TOKEN } }
    );

    const ukVariant = ukVariants.data.variants[0];
    if (!ukVariant) {
      console.log(`⚠️ No matching SKU in UK store for ${sku}`);
      return res.status(404).json({ error: "Variant not found" });
    }

    // 3️⃣ Update UK inventory
    await axios.put(
      `https://${UK_STORE_DOMAIN}/admin/api/2025-01/variants/${ukVariant.id}.json`,
      { variant: { inventory_quantity } },
      { headers: { "X-Shopify-Access-Token": UK_ACCESS_TOKEN } }
    );

    console.log(`✅ Synced ${sku}: UK now has ${inventory_quantity}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Sync error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to sync inventory" });
  }
}
