import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "100kb" }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

function dbReady(res) {
  if (!supabase) {
    res.status(500).json({
      error: "Konfigurasi database belum lengkap. Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY."
    });
    return false;
  }
  return true;
}

function handleDbError(res, error) {
  console.error(error);
  return res.status(500).json({ error: "Terjadi kesalahan database.", detail: error.message });
}

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function requiredText(value, field, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    return `${field} wajib berupa teks 1-${max} karakter.`;
  }
  return null;
}

function validAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

app.get("/", (_req, res) => {
  res.json({
    message: "Personal Finance API aktif",
    version: "1.0.0",
    endpoints: ["/users", "/categories", "/accounts", "/transactions", "/budgets", "/savings-goals"]
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", databaseConfigured: Boolean(supabase) });
});

/* USERS: data profil sederhana untuk kebutuhan tugas. Belum ada autentikasi. */
app.get("/users", async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from("users").select("id, full_name, email, created_at").order("id");
  if (error) return handleDbError(res, error);
  res.json({ data });
});

app.post("/users", async (req, res) => {
  if (!dbReady(res)) return;
  const { full_name, email } = req.body ?? {};
  const validation = requiredText(full_name, "full_name", 120) || requiredText(email, "email", 254);
  if (validation) return res.status(400).json({ error: validation });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Format email tidak valid." });
  const { data, error } = await supabase.from("users").insert({ full_name: full_name.trim(), email: email.trim().toLowerCase() }).select("id, full_name, email, created_at").single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Email sudah terdaftar." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Pengguna berhasil ditambahkan.", data });
});

app.get("/users/:id", async (req, res) => {
  if (!dbReady(res)) return;
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID harus berupa bilangan bulat positif." });
  const { data, error } = await supabase.from("users").select("id, full_name, email, created_at").eq("id", id).maybeSingle();
  if (error) return handleDbError(res, error);
  if (!data) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
  res.json({ data });
});

/* CATEGORIES */
app.get("/categories", async (_req, res) => {
  if (!dbReady(res)) return;
  const { data, error } = await supabase.from("categories").select("*").order("id");
  if (error) return handleDbError(res, error);
  res.json({ data });
});

app.post("/categories", async (req, res) => {
  if (!dbReady(res)) return;
  const { name, type } = req.body ?? {};
  const validation = requiredText(name, "name", 80);
  if (validation) return res.status(400).json({ error: validation });
  if (!["income", "expense"].includes(type)) return res.status(400).json({ error: "type harus income atau expense." });
  const { data, error } = await supabase.from("categories").insert({ name: name.trim(), type }).select("*").single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Kategori dengan nama dan tipe tersebut sudah ada." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Kategori berhasil ditambahkan.", data });
});

/* ACCOUNTS */
app.get("/accounts", async (req, res) => {
  if (!dbReady(res)) return;
  let query = supabase.from("accounts").select("*, users(id, full_name)").order("id");
  if (req.query.user_id !== undefined) {
    const userId = positiveId(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id harus berupa bilangan bulat positif." });
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) return handleDbError(res, error);
  res.json({ data });
});

app.post("/accounts", async (req, res) => {
  if (!dbReady(res)) return;
  const { user_id, name, account_type, initial_balance = 0 } = req.body ?? {};
  const validation = requiredText(name, "name", 80);
  if (validation) return res.status(400).json({ error: validation });
  if (!positiveId(user_id)) return res.status(400).json({ error: "user_id wajib berupa ID positif." });
  if (!["cash", "bank", "ewallet", "other"].includes(account_type)) return res.status(400).json({ error: "account_type harus cash, bank, ewallet, atau other." });
  if (typeof initial_balance !== "number" || !Number.isFinite(initial_balance) || initial_balance < 0) return res.status(400).json({ error: "initial_balance harus angka nol atau lebih." });
  const { data, error } = await supabase.from("accounts").insert({ user_id, name: name.trim(), account_type, initial_balance }).select("*").single();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Rekening berhasil ditambahkan.", data });
});

/* TRANSACTIONS: CRUD lengkap */
app.get("/transactions", async (req, res) => {
  if (!dbReady(res)) return;
  let query = supabase.from("transactions").select("*, users(id, full_name), accounts(id, name), categories(id, name, type)").order("transaction_date", { ascending: false }).order("id", { ascending: false });
  if (req.query.user_id !== undefined) {
    const userId = positiveId(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id harus berupa bilangan bulat positif." });
    query = query.eq("user_id", userId);
  }
  if (req.query.type !== undefined) {
    if (!["income", "expense"].includes(req.query.type)) return res.status(400).json({ error: "type harus income atau expense." });
    query = query.eq("type", req.query.type);
  }
  const { data, error } = await query;
  if (error) return handleDbError(res, error);
  res.json({ count: data.length, data });
});

app.get("/transactions/:id", async (req, res) => {
  if (!dbReady(res)) return;
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID harus berupa bilangan bulat positif." });
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (error) return handleDbError(res, error);
  if (!data) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  res.json({ data });
});

function validateTransaction(body) {
  const { user_id, account_id, category_id, type, amount, description, transaction_date } = body ?? {};
  if (!positiveId(user_id)) return "user_id wajib berupa ID positif.";
  if (!positiveId(account_id)) return "account_id wajib berupa ID positif.";
  if (!positiveId(category_id)) return "category_id wajib berupa ID positif.";
  if (!["income", "expense"].includes(type)) return "type harus income atau expense.";
  if (!validAmount(amount)) return "amount harus angka lebih besar dari nol.";
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 500)) return "description maksimal 500 karakter.";
  if (typeof transaction_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date) || Number.isNaN(Date.parse(`${transaction_date}T00:00:00Z`))) return "transaction_date harus berformat YYYY-MM-DD.";
  return null;
}

app.post("/transactions", async (req, res) => {
  if (!dbReady(res)) return;
  const validation = validateTransaction(req.body);
  if (validation) return res.status(400).json({ error: validation });
  const payload = {
    user_id: req.body.user_id,
    account_id: req.body.account_id,
    category_id: req.body.category_id,
    type: req.body.type,
    amount: req.body.amount,
    description: req.body.description?.trim() || null,
    transaction_date: req.body.transaction_date
  };
  const { data, error } = await supabase.from("transactions").insert(payload).select("*").single();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id, account_id, atau category_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Transaksi berhasil ditambahkan.", data });
});

app.put("/transactions/:id", async (req, res) => {
  if (!dbReady(res)) return;
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID harus berupa bilangan bulat positif." });
  const validation = validateTransaction(req.body);
  if (validation) return res.status(400).json({ error: validation });
  const payload = {
    user_id: req.body.user_id,
    account_id: req.body.account_id,
    category_id: req.body.category_id,
    type: req.body.type,
    amount: req.body.amount,
    description: req.body.description?.trim() || null,
    transaction_date: req.body.transaction_date
  };
  const { data, error } = await supabase.from("transactions").update(payload).eq("id", id).select("*").maybeSingle();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id, account_id, atau category_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  if (!data) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  res.json({ message: "Transaksi berhasil diperbarui.", data });
});

app.patch("/transactions/:id", async (req, res) => {
  if (!dbReady(res)) return;
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID harus berupa bilangan bulat positif." });
  const allowed = ["user_id", "account_id", "category_id", "type", "amount", "description", "transaction_date"];
  const keys = Object.keys(req.body ?? {});
  if (!keys.length) return res.status(400).json({ error: "Isi setidaknya satu field yang ingin diubah." });
  const invalidKey = keys.find((key) => !allowed.includes(key));
  if (invalidKey) return res.status(400).json({ error: `Field '${invalidKey}' tidak diizinkan.` });
  const { data: current, error: findError } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (findError) return handleDbError(res, findError);
  if (!current) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  const merged = { ...current, ...req.body };
  const validation = validateTransaction(merged);
  if (validation) return res.status(400).json({ error: validation });
  const payload = Object.fromEntries(keys.map((key) => [key, merged[key]]));
  if (Object.hasOwn(payload, "description")) payload.description = payload.description?.trim() || null;
  const { data, error } = await supabase.from("transactions").update(payload).eq("id", id).select("*").single();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id, account_id, atau category_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  res.json({ message: "Transaksi berhasil diperbarui.", data });
});

app.delete("/transactions/:id", async (req, res) => {
  if (!dbReady(res)) return;
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID harus berupa bilangan bulat positif." });
  const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id").maybeSingle();
  if (error) return handleDbError(res, error);
  if (!data) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  res.json({ message: "Transaksi berhasil dihapus.", id: data.id });
});

/* BUDGETS */
app.get("/budgets", async (req, res) => {
  if (!dbReady(res)) return;
  let query = supabase.from("budgets").select("*, users(id, full_name), categories(id, name)").order("period_start", { ascending: false });
  if (req.query.user_id !== undefined) {
    const userId = positiveId(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id harus berupa bilangan bulat positif." });
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) return handleDbError(res, error);
  res.json({ data });
});

app.post("/budgets", async (req, res) => {
  if (!dbReady(res)) return;
  const { user_id, category_id, amount_limit, period_start, period_end } = req.body ?? {};
  if (!positiveId(user_id) || !positiveId(category_id)) return res.status(400).json({ error: "user_id dan category_id wajib berupa ID positif." });
  if (!validAmount(amount_limit)) return res.status(400).json({ error: "amount_limit harus angka lebih besar dari nol." });
  if (!isDate(period_start) || !isDate(period_end) || period_end < period_start) return res.status(400).json({ error: "period_start dan period_end harus tanggal YYYY-MM-DD yang valid; period_end tidak boleh sebelum period_start." });
  const { data, error } = await supabase.from("budgets").insert({ user_id, category_id, amount_limit, period_start, period_end }).select("*").single();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id atau category_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Anggaran berhasil ditambahkan.", data });
});

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/* SAVINGS GOALS */
app.get("/savings-goals", async (req, res) => {
  if (!dbReady(res)) return;
  let query = supabase.from("savings_goals").select("*").order("id");
  if (req.query.user_id !== undefined) {
    const userId = positiveId(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id harus berupa bilangan bulat positif." });
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) return handleDbError(res, error);
  res.json({ data });
});

app.post("/savings-goals", async (req, res) => {
  if (!dbReady(res)) return;
  const { user_id, name, target_amount, target_date = null } = req.body ?? {};
  const validation = requiredText(name, "name", 120);
  if (validation) return res.status(400).json({ error: validation });
  if (!positiveId(user_id)) return res.status(400).json({ error: "user_id wajib berupa ID positif." });
  if (!validAmount(target_amount)) return res.status(400).json({ error: "target_amount harus angka lebih besar dari nol." });
  if (target_date !== null && !isDate(target_date)) return res.status(400).json({ error: "target_date harus tanggal YYYY-MM-DD atau null." });
  const { data, error } = await supabase.from("savings_goals").insert({ user_id, name: name.trim(), target_amount, target_date }).select("*").single();
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "user_id tidak ditemukan." });
    return handleDbError(res, error);
  }
  res.status(201).json({ message: "Target tabungan berhasil ditambahkan.", data });
});

/* JSON parse errors and unknown endpoints */
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "JSON request body tidak valid." });
  console.error(err);
  return res.status(500).json({ error: "Terjadi kesalahan server." });
});

app.use((_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));

export default app;

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production") {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Personal Finance API berjalan di http://localhost:${port}`));
}
