# Personal Finance API

REST API sederhana untuk mencatat keuangan pribadi: pengguna, kategori, rekening/dompet, transaksi, anggaran, dan target tabungan.

## Teknologi
- Node.js + Express
- PostgreSQL melalui Supabase
- Vercel untuk deployment
- Thunder Client atau Postman untuk pengujian

## Tabel database
1. `users` — profil pengguna
2. `categories` — kategori income/expense
3. `accounts` — rekening atau dompet
4. `transactions` — transaksi pemasukan/pengeluaran
5. `budgets` — batas anggaran pada periode tertentu
6. `savings_goals` — target tabungan

Lihat [database/schema.sql](database/schema.sql). ERD bisa dibuat dengan mengimpor SQL tersebut ke https://dbdiagram.io/ atau menyalin definisi tabel yang relevan. Simpan gambar hasilnya di `docs/erd.png`, lalu tambahkan ke README:

```md
![ERD Personal Finance API](docs/erd.png)
```

## Deployment
- URL Vercel: **isi setelah deploy**, misalnya `https://nama-project.vercel.app`
- Supabase project URL: simpan sebagai environment variable, jangan tulis secret ke README.

## Menjalankan secara lokal
1. Instal Node.js versi LTS.
2. Buat project Supabase dan jalankan `database/schema.sql` di SQL Editor.
3. Salin `.env.example` menjadi `.env`.
4. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dari Supabase Dashboard > Project Settings > API.
5. Jalankan:

   ```bash
   npm install
   npm run dev
   ```

6. Buka `http://localhost:3000/`. Untuk pengujian lokal gunakan URL tersebut; setelah deploy, gunakan URL Vercel.

**Jangan pernah commit `.env`.** `SUPABASE_SERVICE_ROLE_KEY` adalah secret server-side dan memiliki hak akses tinggi.

## Format umum
- Request/response menggunakan JSON.
- Header untuk request yang memiliki body: `Content-Type: application/json`.
- ID harus berupa bilangan bulat positif.
- Nilai uang dikirim sebagai angka positif.
- `type` transaksi/kategori: `income` atau `expense`.
- Status umum: `200` sukses, `201` data dibuat, `400` input tidak valid, `404` data/endpoint tidak ditemukan, `409` duplikat, `500` kesalahan server.

## Endpoint API

Ganti `BASE_URL` dengan URL Vercel setelah deployment. Saat lokal, gunakan `http://localhost:3000`.

### 1. Health check
- Method: `GET`
- URL: `BASE_URL/health`
- Deskripsi: memeriksa API aktif dan konfigurasi database terdeteksi.
- Response `200`:
  ```json
  { "status": "ok", "databaseConfigured": true }
  ```

### 2. Daftar pengguna
- Method: `GET`
- URL: `BASE_URL/users`
- Deskripsi: mengambil seluruh pengguna.
- Response `200`:
  ```json
  { "data": [{ "id": 1, "full_name": "Budi", "email": "budi@example.com", "created_at": "2026-10-12T00:00:00Z" }] }
  ```

### 3. Tambah pengguna
- Method: `POST`
- URL: `BASE_URL/users`
- Headers: `Content-Type: application/json`
- Request body:
  ```json
  { "full_name": "Budi Santoso", "email": "budi@example.com" }
  ```
- Response sukses `201`: `{ "message": "Pengguna berhasil ditambahkan.", "data": { "id": 1, "full_name": "Budi Santoso", "email": "budi@example.com" } }`
- Response error `400`: `{ "error": "Format email tidak valid." }`
- Response error `409`: `{ "error": "Email sudah terdaftar." }`

### 4. Detail pengguna
- Method: `GET`
- URL: `BASE_URL/users/1`
- Deskripsi: mengambil pengguna dengan ID 1.
- Response `200`: `{ "data": { "id": 1, "full_name": "Budi Santoso", "email": "budi@example.com" } }`
- Response `404`: `{ "error": "Pengguna tidak ditemukan." }`

### 5. Daftar kategori
- Method: `GET`
- URL: `BASE_URL/categories`
- Deskripsi: mengambil kategori.
- Response `200`: `{ "data": [{ "id": 1, "name": "Gaji", "type": "income" }] }`

### 6. Tambah kategori
- Method: `POST`
- URL: `BASE_URL/categories`
- Body:
  ```json
  { "name": "Hadiah", "type": "income" }
  ```
- Response `201`: `{ "message": "Kategori berhasil ditambahkan.", "data": { "id": 7, "name": "Hadiah", "type": "income" } }`
- Error `400`: `{ "error": "type harus income atau expense." }`

### 7. Daftar rekening
- Method: `GET`
- URL: `BASE_URL/accounts`
- Query opsional: `?user_id=1`
- Response `200`: `{ "data": [{ "id": 1, "user_id": 1, "name": "Dompet", "account_type": "cash", "initial_balance": 100000 }] }`

### 8. Tambah rekening
- Method: `POST`
- URL: `BASE_URL/accounts`
- Body:
  ```json
  { "user_id": 1, "name": "Dompet", "account_type": "cash", "initial_balance": 100000 }
  ```
- Response `201`: `{ "message": "Rekening berhasil ditambahkan.", "data": { "id": 1, "user_id": 1, "name": "Dompet" } }`
- Error `400`: `{ "error": "user_id tidak ditemukan." }`

### 9. Daftar transaksi
- Method: `GET`
- URL: `BASE_URL/transactions`
- Query opsional: `?user_id=1` atau `?type=expense` atau gabungan `?user_id=1&type=expense`
- Response `200`: `{ "count": 1, "data": [{ "id": 1, "type": "expense", "amount": 25000, "description": "Makan siang" }] }`

### 10. Detail transaksi
- Method: `GET`
- URL: `BASE_URL/transactions/1`
- Response `200`: `{ "data": { "id": 1, "type": "expense", "amount": 25000, "description": "Makan siang" } }`
- Response `404`: `{ "error": "Transaksi tidak ditemukan." }`

### 11. Tambah transaksi
- Method: `POST`
- URL: `BASE_URL/transactions`
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "user_id": 1,
    "account_id": 1,
    "category_id": 3,
    "type": "expense",
    "amount": 25000,
    "description": "Makan siang",
    "transaction_date": "2026-10-12"
  }
  ```
- Response `201`: `{ "message": "Transaksi berhasil ditambahkan.", "data": { "id": 1, "type": "expense", "amount": 25000 } }`
- Error `400`: `{ "error": "amount harus angka lebih besar dari nol." }`

### 12. Ganti seluruh data transaksi
- Method: `PUT`
- URL: `BASE_URL/transactions/1`
- Headers: `Content-Type: application/json`
- Body: kirim semua field wajib seperti contoh POST.
- Response `200`: `{ "message": "Transaksi berhasil diperbarui.", "data": { "id": 1, "amount": 30000 } }`
- Error `404`: `{ "error": "Transaksi tidak ditemukan." }`

### 13. Ubah sebagian data transaksi
- Method: `PATCH`
- URL: `BASE_URL/transactions/1`
- Body:
  ```json
  { "amount": 30000, "description": "Makan siang dan minum" }
  ```
- Response `200`: `{ "message": "Transaksi berhasil diperbarui.", "data": { "id": 1, "amount": 30000 } }`
- Error `400`: `{ "error": "amount harus angka lebih besar dari nol." }`

### 14. Hapus transaksi
- Method: `DELETE`
- URL: `BASE_URL/transactions/1`
- Deskripsi: menghapus transaksi dengan ID 1.
- Response `200`: `{ "message": "Transaksi berhasil dihapus.", "id": 1 }`
- Response `404`: `{ "error": "Transaksi tidak ditemukan." }`

### 15. Daftar anggaran
- Method: `GET`
- URL: `BASE_URL/budgets`
- Query opsional: `?user_id=1`
- Response `200`: `{ "data": [{ "id": 1, "user_id": 1, "category_id": 3, "amount_limit": 500000, "period_start": "2026-10-01", "period_end": "2026-10-31" }] }`

### 16. Tambah anggaran
- Method: `POST`
- URL: `BASE_URL/budgets`
- Body:
  ```json
  { "user_id": 1, "category_id": 3, "amount_limit": 500000, "period_start": "2026-10-01", "period_end": "2026-10-31" }
  ```
- Response `201`: `{ "message": "Anggaran berhasil ditambahkan.", "data": { "id": 1, "amount_limit": 500000 } }`

### 17. Daftar target tabungan
- Method: `GET`
- URL: `BASE_URL/savings-goals`
- Query opsional: `?user_id=1`
- Response `200`: `{ "data": [{ "id": 1, "user_id": 1, "name": "Laptop", "target_amount": 5000000, "target_date": "2027-06-01" }] }`

### 18. Tambah target tabungan
- Method: `POST`
- URL: `BASE_URL/savings-goals`
- Body:
  ```json
  { "user_id": 1, "name": "Laptop", "target_amount": 5000000, "target_date": "2027-06-01" }
  ```
- Response `201`: `{ "message": "Target tabungan berhasil ditambahkan.", "data": { "id": 1, "name": "Laptop", "target_amount": 5000000 } }`

## Urutan pengujian
1. `GET /health`
2. `POST /users`, lalu catat `id` pengguna.
3. `POST /accounts` memakai `user_id` tadi.
4. `GET /categories`, catat ID kategori yang cocok (`expense` misalnya Makanan).
5. `POST /transactions` memakai ketiga ID yang valid.
6. Tes `GET /transactions`, `GET /transactions/:id`, `PUT`, `PATCH`, dan terakhir `DELETE`.
7. Tes kategori, rekening, anggaran, dan target tabungan.
8. Ulangi semua pengujian menggunakan URL Vercel, bukan hanya localhost.

## Pengujian input error
- `POST /transactions` dengan `amount: 0` harus menghasilkan `400`.
- `GET /transactions/999999` harus menghasilkan `404` jika ID tersebut tidak ada.
- `POST /users` dengan email yang sudah digunakan harus menghasilkan `409`.

## Batasan versi tugas
Versi pembelajaran ini belum menerapkan login/autentikasi dan menggunakan service-role key hanya di server. Jangan masukkan data finansial nyata atau membuka key ke browser. Sebelum penggunaan nyata, tambahkan autentikasi, otorisasi per pengguna, dan kebijakan keamanan database yang sesuai.
