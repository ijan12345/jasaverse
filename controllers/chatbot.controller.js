// controllers/chatbot.controller.js
import axios from "axios";
import Fuse from "fuse.js";


/**
 * 🔹 FAQ Bahasa Indonesia
 */
const faqID = {
  "Order & Transaksi": [
    { q: "Cara daftar jadi penjual?", a: "Buka halaman login → klik 'Daftar disini' → pilih 'Daftar sebagai Penjual' → selesai." },
    { q: "Bagaimana cara membuat pesanan?", a: "Pilih jasa → tekan tombol 'Beli Sekarang' → isi data → pilih metode pembayaran → jika sukses, order muncul di menu Order." },
    { q: "Apa yang terjadi setelah order dibuat?", a: "Order akan berstatus 'pending'. Seller harus menerima order. Jika tidak merespons dalam 30 hari, sistem otomatis melakukan refund." },
    { q: "Bagaimana cara penjual menerima atau menolak order?", a: "Penjual buka menu Order → pilih order → klik 'Terima Layanan' atau 'Tolak Order'. Jika ditolak, dana dikembalikan ke buyer." },
    { q: "Kapan saldo masuk ke penjual?", a: "Dana ditahan (escrow) selama order berjalan. Setelah buyer menekan 'Selesaikan Order', dana dilepas ke saldo penjual." },
    { q: "Bagaimana jika ada masalah dengan order?", a: "Buyer dapat melaporkan sengketa melalui tombol 'Laporkan Sengketa'. Jika seller tidak merespons dalam 2x24 jam, sistem refund otomatis." },
    { q: "Apa itu permintaan tambahan (extra request)?", a: "Seller dapat mengajukan tambahan, seperti revisi atau fitur ekstra. Buyer akan menerima invoice tambahan yang dapat dibayar langsung di aplikasi." },
    { q: "Bagaimana cara membayar extra request?", a: "Buyer akan menerima notifikasi di order → klik 'Bayar Sekarang' → bayar via invoice Xendit → status order akan otomatis diperbarui." },
    { q: "Bagaimana cara melihat struk order?", a: "Buka menu Order → pilih order → klik 'Lihat Struk'. Struk menampilkan detail transaksi, escrow, progress, dan deadline." },
    { q: "Apakah order bisa dihapus?", a: "Order yang selesai atau dibatalkan bisa dihapus dari daftar (hanya disembunyikan, tidak dihapus dari sistem)." },
    { q: "Bagaimana cara withdraw saldo?", a: "Buka menu Profil → Penarikan → masukkan jumlah → pilih metode → isi rekening → klik 'Kirim Penarikan'." },
    { q: "Bagaimana cara kerja pembayaran via Xendit?", a: "Setelah memilih jasa, Anda diarahkan ke halaman pembayaran Xendit. Ikuti langkah pembayaran, dan invoice dikirim ke email Anda." },
    { q: "Apa yang terjadi jika saya sudah memiliki order aktif untuk jasa yang sama?", a: "Anda tidak bisa membuat order baru untuk jasa yang sama jika masih ada order aktif (pending, in_progress, atau accepted)." },
    { q: "Apa batasan harga untuk permintaan tambahan?", a: "Total harga order, termasuk tambahan, tidak boleh melebihi Rp10.000.000." },
    { q: "Apa batasan hari untuk permintaan tambahan?", a: "Total waktu pengerjaan, termasuk tambahan hari, tidak boleh melebihi 20 hari." },
    { q: "Apa yang terjadi jika penjual tidak merespons sengketa dalam 48 jam?", a: "Jika penjual tidak merespons dalam 48 jam, sistem otomatis refund ke pembeli dan status order jadi 'canceled'." },
    { q: "Bagaimana admin menyelesaikan sengketa?", a: "Admin akan meninjau laporan dan respons penjual. Admin dapat memutuskan untuk refund ke buyer, melepas dana ke seller, atau menolak sengketa." },
    { q: "Berapa lama proses penyelesaian sengketa?", a: "Durasi tergantung kasus. Admin akan menghubungi Anda via email atau chat untuk info lebih lanjut." },
    { q: "Bisakah admin menghapus order saya?", a: "Ya. Admin dapat menghapus order dalam kasus tertentu, seperti pelanggaran kebijakan atau sengketa tidak terselesaikan." },
    { q: "Apa perbedaan saldo pending dan saldo tersedia?", a: "Saldo pending adalah dana yang masih ditahan (escrow). Saldo tersedia adalah dana yang sudah bisa ditarik setelah order selesai." },
    { q: "Apakah transaksi saya dipantau oleh admin?", a: "Ya, semua transaksi dipantau untuk memastikan keamanan dan kelancaran proses." },
    { q: "Bagaimana cara penjual menolak permintaan tambahan?", a: "Penjual dapat menolak permintaan tambahan di menu Order → pilih order → klik 'Tolak Permintaan Tambahan'." },
    { q: "Apa itu saldo escrow dan biaya admin?", a: "Saldo escrow adalah dana dari order selesai yang belum ditarik, dikurangi biaya admin (default 12%). Anda bisa melihatnya di Profil → Saldo." },
  ],

  "Profil & Akun": [
    { q: "Bagaimana cara mengganti nomor telepon?", a: "Buka Profil → klik ikon pensil di Nomor Telepon → masukkan nomor baru → simpan." },
    { q: "Bagaimana cara mengubah deskripsi profil?", a: "Buka Profil → klik ikon pensil di Deskripsi → edit teks → simpan." },
    { q: "Bagaimana cara mengganti foto profil?", a: "Buka Profil → tekan foto → pilih gambar dari galeri → simpan." },
    { q: "Bagaimana cara mengunggah CV atau Sertifikat?", a: "Profil → pilih 'Upload CV', 'Upload Sertifikat LDKM', atau 'Upload Sertifikat PPKMB' → pilih file → simpan." },
    { q: "Apa itu skor dan ranking seller?", a: "Skor dihitung dari jumlah penjualan dan gig. Ranking ditentukan dari skor tertinggi di platform." },
    { q: "Bagaimana cara melihat rating saya?", a: "Profil seller menampilkan rating (1–5) dari review buyer dan jumlah ulasan." },
    { q: "Kenapa saya tidak bisa daftar dengan email tertentu?", a: "Beberapa email diblokir admin untuk mencegah penyalahgunaan. Gunakan email lain yang valid." },
    { q: "Apa itu poin penjual?", a: "Poin diberikan setiap order selesai (+9 poin). Poin memengaruhi ranking di platform." },
    { q: "Bagaimana cara menghapus akun saya?", a: "Hubungi support via email/WhatsApp untuk penghapusan akun. Semua data akan dihapus permanen." },
    { q: "Bagaimana cara melihat peringkat fakultas saya?", a: "Profil → Peringkat Fakultas. Dihitung dari skor total penjual di fakultas Anda." },
    { q: "Bagaimana cara memeriksa ketersediaan username?", a: "Saat daftar/ubah username, sistem otomatis memberitahu jika sudah digunakan." },
    { q: "Bagaimana cara melihat tanggal pendaftaran akun?", a: "Profil → Informasi Akun → lihat tanggal pendaftaran (format lengkap)." },
  ],

  "Login": [
    { q: "Lupa username atau password?", a: "Login → klik 'Lupa Username atau Password?' → masukkan email → verifikasi OTP → buat password baru." },
  ],

  "Review & Rating": [
    { q: "Bagaimana cara memberi review?", a: "Buka gig yang sudah diorder → scroll ke review → beri bintang (1–5) dan komentar → kirim." },
    { q: "Siapa yang bisa memberi review?", a: "Hanya buyer yang sudah order dan seller pemilik gig." },
    { q: "Apakah bisa memberi lebih dari 1 review?", a: "Tidak. Setiap user hanya bisa memberi 1 review per gig." },
    { q: "Bagaimana cara menghapus review?", a: "Buka menu review Anda → klik ikon tempat sampah → konfirmasi hapus." },
    { q: "Apa yang terjadi jika review dihapus?", a: "Review hilang dari gig, dan skor rating seller diperbarui otomatis." },
    { q: "Bagaimana cara melaporkan review tidak pantas?", a: "Klik titik tiga → pilih 'Laporkan' → isi alasan → kirim. Admin akan meninjau." },
    { q: "Apakah bisa like/dislike review?", a: "Ya. Anda bisa memberi like/dislike untuk menandai review yang bermanfaat." },
    { q: "Apakah review bisa diedit?", a: "Saat ini tidak bisa. Hapus review lama, lalu buat ulang jika perlu." },
  ],

  "Chat & Pesan": [
    { q: "Bagaimana cara mengirim pesan ke penjual?", a: "Order → pilih order → klik 'Chat'. Anda bisa mengirim teks atau gambar." },
    { q: "Apakah bisa kirim file selain gambar?", a: "Saat ini hanya mendukung gambar (JPG, PNG, WebP)." },
    { q: "Bagaimana cara menghapus pesan?", a: "Tekan lama pesan → pilih 'Hapus untuk Saya' atau 'Hapus untuk Semua'." },
    { q: "Apakah pesan bisa dibaca ulang setelah dihapus?", a: "Tidak. Jika dihapus untuk semua, pesan hilang permanen." },
    { q: "Apa arti tanda centang di pesan?", a: "✓ terkirim, ✓✓ abu-abu sampai, ✓✓ biru sudah dibaca." },
    { q: "Apakah saya bisa tahu jika penjual sedang mengetik?", a: "Ya. Akan muncul notifikasi 'Sedang mengetik...'." },
    { q: "Bagaimana cara menghapus percakapan?", a: "Buka daftar percakapan → pilih → hapus. Jika kedua pihak hapus, percakapan hilang permanen." },
    { q: "Kenapa pesan tidak terkirim?", a: "Cek koneksi internet. Jika tetap gagal, coba login ulang." },
    { q: "Apakah admin bisa ikut percakapan?", a: "Ya, admin dapat memantau chat buyer-seller saat terjadi sengketa." },
    { q: "Apa yang terjadi setelah order selesai/dibatalkan?", a: "Percakapan dan file terkait akan otomatis dihapus dari sistem." },
  ],

  "Request & Offer": [
    { q: "Apa itu Request?", a: "Request adalah permintaan buyer berisi judul, deskripsi, budget, waktu pengerjaan, dan cover. Berlaku 15 hari." },
    { q: "Bagaimana cara membuat Request?", a: "Menu Request → klik 'Buat Request' → isi data → upload cover → submit." },
    { q: "Kenapa Request saya hilang?", a: "Request otomatis dihapus setelah 15 hari, termasuk cover-nya." },
    { q: "Bagaimana seller merespon Request?", a: "Seller buka Request buyer → pilih Gig → kirim penawaran (offer)." },
    { q: "Apa itu Offer?", a: "Offer adalah penawaran gig dari seller sebagai respons terhadap Request buyer." },
    { q: "Bagaimana status Offer ditentukan?", a: "Offer berstatus 'pending' hingga buyer menerima ('accepted') atau menolak ('rejected')." },
    { q: "Kenapa tombol 'Tawarkan' tidak aktif?", a: "Tombol nonaktif jika buyerId tidak tersedia atau Gig sudah pernah ditawarkan ke Request itu." },
    { q: "Apakah saya bisa edit Request?", a: "Tidak. Jika salah, hapus dan buat Request baru." },
  ],

  "Incoming Offers": [
    { q: "Apa itu Incoming Offers?", a: "Daftar penawaran seller terhadap Request Anda." },
    { q: "Berapa lama Request tampil di Incoming Offers?", a: "Aktif selama 15 hari. Setelah itu, semua request & offer expired." },
    { q: "Bagaimana cara melihat offer yang masuk?", a: "Menu Incoming Offers → pilih Request → expand untuk melihat daftar offer." },
    { q: "Bagaimana cara menerima offer?", a: "Klik ikon centang (✅). Status berubah menjadi 'accepted' dan seller mulai bekerja." },
    { q: "Bagaimana cara menolak offer?", a: "Klik ikon silang (❌). Status berubah menjadi 'rejected'." },
    { q: "Bisakah menerima lebih dari satu offer per Request?", a: "Tidak. Hanya satu offer dapat diterima. Lainnya tetap pending/rejected." },
    { q: "Bagaimana cara menghapus Request?", a: "Buka Incoming Offers → klik ikon sampah → konfirmasi hapus." },
    { q: "Kenapa ada timer di setiap Request?", a: "Timer menunjukkan sisa waktu sebelum Request expired (maksimal 15 hari)." },
  ],

  "Revisi Order": [
    { q: "Bagaimana cara penjual mengajukan revisi?", a: "Penjual buka menu Order → pilih order → klik 'Ajukan Revisi'. Pembeli akan menerima notifikasi untuk menyetujui atau menolak." },
    { q: "Bagaimana cara pembeli menyetujui atau menolak revisi?", a: "Buka menu Order → pilih order dengan notifikasi revisi → klik 'Setujui' (✅) atau 'Tolak' (❌)." },
    { q: "Apa yang terjadi jika revisi habis?", a: "Jika revisi mencapai batas (revisionLimit), penjual tidak dapat mengajukan revisi lagi kecuali melalui extra request." },
  ],

  "Rewards & Poin": [
    { q: "Apa itu sistem rewards?", a: "Rewards memungkinkan Anda menukar poin dengan saldo DANA. Poin didapat dari menyelesaikan order dan membuat gig." },
    { q: "Bagaimana cara mendapatkan poin?", a: "Setiap order selesai memberi +9 poin dan setiap gig aktif memberi +1 poin." },
    { q: "Bagaimana cara menukar poin?", a: "Buka menu Rewards → pilih reward sesuai poin → klik 'Redeem' → konfirmasi." },
    { q: "Berapa lama proses redeem?", a: "Admin akan memverifikasi dan mentransfer saldo DANA dalam 1–3 hari kerja." },
    { q: "Apakah poin langsung berkurang?", a: "Tidak langsung, namun reward akan dikunci agar tidak bisa diklaim ulang." },
    { q: "Bagaimana jika admin menolak redeem?", a: "Status menjadi 'rejected', dan Anda bisa mengajukan ulang." },
    { q: "Bagaimana tahu reward disetujui?", a: "Anda akan mendapat notifikasi ketika status berubah jadi 'approved'." },
    { q: "Apa syarat redeem DANA?", a: "Pastikan nomor HP dan data diri sama dengan akun DANA Anda." },
    { q: "Bisakah redeem lebih dari satu kali?", a: "Ya, selama poin cukup dan tidak ada redeem pending." },
    { q: "Apakah ada batas maksimal redeem?", a: "Tidak, tapi setiap level reward punya poin minimum berbeda (10–10.000)." },
  ],

  "Leaderboard & Ranking": [
    { q: "Apa itu Leaderboard?", a: "Fitur untuk melihat peringkat penjual berdasarkan total poin tertinggi." },
    { q: "Bagaimana perhitungan poin?", a: "Dihitung dari order selesai dan gig aktif." },
    { q: "Apakah diperbarui otomatis?", a: "Ya, real-time setiap ada order selesai." },
    { q: "Bagaimana cara melihat peringkat fakultas?", a: "Buka Profil → Peringkat Fakultas untuk melihat ranking lokal." },
  ],

  "Fitur yang Akan Datang 🚀": [
    { q: "Apa fitur baru yang akan hadir?", a: "Fitur badge seller, notifikasi real-time untuk reward, dan mode komunitas freelance." },
    { q: "Kapan dirilis?", a: "Akan diumumkan lewat menu Pengumuman atau email resmi." },
    { q: "Bisakah saya memberi masukan fitur?", a: "Tentu! Gunakan tombol 'Kontak Support' untuk mengirim ide Anda." },
  ],
};


/**
 * 🔹 FAQ Bahasa Inggris
 */
const faqEN = {
  "Orders & Transactions": [
    { q: "How do I register as a seller?", a: "Go to the login page → click 'Register here' → choose 'Register as Seller' → done." },
    { q: "How do I place an order?", a: "Select a service → press 'Buy Now' → fill in your details → choose a payment method → once successful, the order will appear in the Orders menu." },
    { q: "What happens after I create an order?", a: "Your order will have a 'pending' status. The seller must accept it. If not accepted within 30 days, the system automatically issues a refund." },
    { q: "How can sellers accept or reject orders?", a: "Go to Orders → select the order → click 'Accept Service' or 'Reject Order'. If rejected, funds will be returned to the buyer." },
    { q: "When do sellers receive their balance?", a: "Funds are held in escrow during the order process. Once the buyer presses 'Complete Order', the funds are released to the seller’s balance." },
    { q: "What if there’s an issue with an order?", a: "Buyers can report a dispute using the 'Report Dispute' button. If the seller does not respond within 48 hours, the system automatically refunds the buyer." },
    { q: "What is an extra request?", a: "An extra request is an additional feature or revision proposed by the seller. The buyer will receive an invoice that can be paid directly in the app." },
    { q: "How do I pay for an extra request?", a: "Buyers will get a notification → click 'Pay Now' → complete payment via Xendit invoice → the order status updates automatically." },
    { q: "How can I view my order receipt?", a: "Go to Orders → select your order → click 'View Receipt'. It shows transaction details, escrow, progress, and deadline." },
    { q: "Can I delete an order?", a: "Completed or canceled orders can be hidden from your list (not permanently deleted)." },
    { q: "How can I withdraw my balance?", a: "Go to Profile → Withdraw → enter the amount → choose a method → fill in your bank account → click 'Submit Withdrawal'." },
    { q: "How does Xendit payment work?", a: "After selecting a service, you’ll be redirected to the Xendit payment page. Follow the steps, and the invoice will be sent to your email." },
    { q: "What happens if I already have an active order for the same service?", a: "You cannot create another order for the same gig if one is still active (pending, in_progress, or accepted)." },
    { q: "What’s the price limit for extra requests?", a: "The total order price, including extras, cannot exceed Rp10,000,000." },
    { q: "What’s the time limit for extra requests?", a: "The total work duration, including extra days, cannot exceed 20 days." },
    { q: "What happens if the seller doesn’t respond to a dispute?", a: "If the seller does not respond within 48 hours, the system automatically refunds the buyer and marks the order as 'canceled'." },
    { q: "How does the admin resolve disputes?", a: "Admins review reports and responses, and may decide to refund the buyer, release funds to the seller, or reject the dispute." },
    { q: "How long does it take to resolve a dispute?", a: "The duration depends on the case. Admin will contact you via email or chat for updates." },
    { q: "Can the admin delete my order?", a: "Yes. Admin may delete orders in special cases, such as policy violations or unresolved disputes." },
    { q: "What’s the difference between pending and available balance?", a: "Pending balance is funds held in escrow. Available balance is the amount you can withdraw after completion." },
    { q: "Are transactions monitored by admins?", a: "Yes, all transactions are monitored to ensure safety and fairness." },
    { q: "How can sellers reject an extra request?", a: "Go to Orders → select the order → click 'Reject Extra Request'." },
    { q: "What is escrow balance and admin fee?", a: "Escrow balance is funds from completed orders (minus 12% admin fee). You can check it in Profile → Balance." },
  ],

  "Profile & Account": [
    { q: "How do I change my phone number?", a: "Go to Profile → click the pencil icon next to Phone Number → enter the new number → save." },
    { q: "How do I edit my profile description?", a: "Go to Profile → click the pencil icon next to Description → edit → save." },
    { q: "How do I change my profile photo?", a: "Go to Profile → tap your photo → select an image from your gallery → save." },
    { q: "How do I upload a CV or Certificate?", a: "Profile → select 'Upload CV', 'Upload LDKM Certificate', or 'Upload PPKMB Certificate' → choose file → save." },
    { q: "What are seller scores and ranking?", a: "Scores are based on total sales and gigs. Rankings are determined by top scores on the platform." },
    { q: "How can I view my rating?", a: "Your profile shows your average rating (1–5 stars) and total reviews." },
    { q: "Why can’t I register with my email?", a: "Some emails are blocked by admin to prevent misuse. Please use another valid email." },
    { q: "What are seller points?", a: "You earn +9 points for each completed order. Points affect your ranking on the leaderboard." },
    { q: "How do I delete my account?", a: "Contact support via email or WhatsApp to delete your account permanently." },
    { q: "How do I see my faculty ranking?", a: "Go to Profile → Faculty Ranking. Calculated from total points in your faculty." },
    { q: "How do I check if a username is available?", a: "When entering a username, the system will notify you if it’s already taken." },
    { q: "How can I see my account registration date?", a: "Profile → Account Info → view registration date (full format)." },
  ],

  "Login": [
    { q: "Forgot username or password?", a: "Login → click 'Forgot Username or Password?' → enter email → verify OTP → create a new password." },
  ],

  "Reviews & Ratings": [
    { q: "How do I write a review?", a: "Open the gig you ordered → scroll to the review section → rate 1–5 stars and write a comment → submit." },
    { q: "Who can write reviews?", a: "Only buyers who completed an order and the seller of the gig." },
    { q: "Can I write more than one review?", a: "No. Each user can write only one review per gig." },
    { q: "How do I delete a review?", a: "Go to your reviews → click the trash icon → confirm deletion." },
    { q: "What happens after deleting a review?", a: "It disappears from the gig, and the seller’s average rating updates automatically." },
    { q: "How do I report an inappropriate review?", a: "Click the three dots → select 'Report' → write the reason → submit. Admin will review it." },
    { q: "Can I like or dislike reviews?", a: "Yes, you can mark reviews as helpful or not helpful." },
    { q: "Can reviews be edited?", a: "Not yet. You can delete and re-submit a new one." },
  ],

  "Chat & Messages": [
    { q: "How do I send a message to the seller?", a: "Orders → select an order → click 'Chat'. You can send text or images." },
    { q: "Can I send files other than images?", a: "Currently, only image formats (JPG, PNG, WebP) are supported." },
    { q: "How do I delete a message?", a: "Long-press a message → choose 'Delete for Me' or 'Delete for Everyone'." },
    { q: "Can deleted messages be recovered?", a: "No, deleted messages are permanently removed." },
    { q: "What do message ticks mean?", a: "✓ sent, ✓✓ gray delivered, ✓✓ blue read." },
    { q: "Can I see when the seller is typing?", a: "Yes, you’ll see a 'Typing...' indicator in the chat." },
    { q: "How do I delete a conversation?", a: "Go to your chat list → select → delete. If both users delete it, the chat is permanently removed." },
    { q: "Why didn’t my message send?", a: "Check your internet connection. If the issue persists, try logging in again." },
    { q: "Can admins access my chat?", a: "Yes, admins can monitor chats between buyer and seller during disputes." },
    { q: "What happens after an order is completed or canceled?", a: "The related chat and media files will be automatically deleted." },
  ],

  "Requests & Offers": [
    { q: "What is a Request?", a: "A Request is a job posting from a buyer with title, description, budget, duration, and cover. It’s valid for 15 days." },
    { q: "How do I create a Request?", a: "Go to Requests → click 'Create Request' → fill the form → upload a cover → submit." },
    { q: "Why did my Request disappear?", a: "Requests automatically expire and are deleted after 15 days, including the cover file." },
    { q: "How do sellers respond to Requests?", a: "Sellers open a Request → select a gig → send an offer." },
    { q: "What is an Offer?", a: "An offer is a seller’s proposal in response to a buyer’s request." },
    { q: "How is Offer status determined?", a: "Offers stay 'pending' until accepted or rejected by the buyer." },
    { q: "Why is the 'Offer' button disabled?", a: "It’s disabled if buyerId is unavailable or the same gig has already been offered." },
    { q: "Can I edit a Request?", a: "No. Delete and create a new Request if needed." },
  ],

  "Incoming Offers": [
    { q: "What are Incoming Offers?", a: "A list of seller offers submitted to your Requests." },
    { q: "How long are Requests active?", a: "Each Request remains active for 15 days before expiring." },
    { q: "How do I view incoming offers?", a: "Go to Incoming Offers → select a Request → expand to view all offers." },
    { q: "How do I accept an offer?", a: "Click the checkmark (✅). Status changes to 'accepted', and the seller begins work." },
    { q: "How do I reject an offer?", a: "Click the cross (❌). Status changes to 'rejected'." },
    { q: "Can I accept more than one offer per Request?", a: "No, only one offer can be accepted per Request." },
    { q: "How do I delete a Request?", a: "Go to Incoming Offers → click the trash icon → confirm delete." },
    { q: "Why is there a timer on Requests?", a: "It shows the remaining time before the Request expires (max 15 days)." },
  ],

  "Order Revisions": [
    { q: "How do sellers request a revision?", a: "Go to Orders → select order → click 'Request Revision'. The buyer will receive a notification." },
    { q: "How do buyers approve or reject revisions?", a: "Open the order → click 'Approve' (✅) or 'Reject' (❌) when prompted." },
    { q: "What if the revision limit is reached?", a: "Once the revision limit is reached, sellers can’t request more unless through an extra request." },
  ],

  "Rewards & Points": [
    { q: "What is the Rewards system?", a: "Rewards let you exchange points for DANA balance. Points come from completed orders and active gigs." },
    { q: "How do I earn points?", a: "You earn +9 points for each completed order and +1 for each active gig." },
    { q: "How do I redeem my points?", a: "Go to Rewards → select a reward → tap 'Redeem' → confirm." },
    { q: "How long does redemption take?", a: "Admin verifies your request and transfers funds to DANA within 1–3 business days." },
    { q: "Are points deducted immediately?", a: "No, but the redeemed reward will be locked from re-claiming." },
    { q: "What if my redemption is rejected?", a: "The status will become 'rejected', and you can try again later." },
    { q: "How do I know my reward is approved?", a: "You’ll receive a notification once the status changes to 'approved'." },
    { q: "What are the DANA requirements?", a: "Make sure your phone number and identity match your DANA account." },
    { q: "Can I redeem more than once?", a: "Yes, as long as you have enough points and no pending requests." },
    { q: "Is there a maximum redeem limit?", a: "No, but each reward tier has its own minimum points (10–10,000)." },
  ],

  "Leaderboard & Ranking": [
    { q: "What is the Leaderboard?", a: "A feature to see top sellers ranked by total points." },
    { q: "How are points calculated?", a: "Points come from completed orders and active gigs." },
    { q: "Is the leaderboard updated automatically?", a: "Yes, it updates in real time whenever an order is completed." },
    { q: "How do I view my faculty ranking?", a: "Go to Profile → Faculty Ranking to see your position." },
  ],

  "Upcoming Features 🚀": [
    { q: "What new features are coming?", a: "Seller badges, real-time reward notifications, and a freelance community mode." },
    { q: "When will they be released?", a: "They will be announced through the Announcements menu or official email." },
    { q: "Can I suggest new features?", a: "Absolutely! Use the 'Contact Support' button to send your ideas." },
  ],
};


/**
 * 🔹 Helper: build string FAQ
 */
function buildContext(faqObj) {
  return Object.entries(faqObj)
    .map(([section, faqs]) =>
      `## ${section}\n${faqs
        .map((f, i) => `${i + 1}. Q: ${f.q}\n   A: ${f.a}`)
        .join("\n")}`
    )
    .join("\n\n");
}

/**
 * 🔹 Controller utama
 */
export const askChatbot = async (req, res) => {
  try {
    const { message, lang } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // 🔸 Pilih bahasa FAQ
    const userLang = lang === "en" ? "en" : "id";
    const faqData = userLang === "en" ? faqEN : faqID;

    // 🔸 Gabungkan semua FAQ dari berbagai kategori jadi satu array
    const allFaqs = Object.values(faqData).flat();

    // 🔸 Setup Fuse.js (buat pencarian fuzzy)
    const fuse = new Fuse(allFaqs, {
      keys: ["q"],       // fokus pencarian di field pertanyaan
      includeScore: true, // supaya bisa tahu seberapa mirip
      threshold: 0.4,     // makin kecil makin ketat (0.4 = cocok tapi fleksibel)
      distance: 100,      // toleransi jarak antar kata
    });

    // 🔸 Cari pertanyaan paling mirip
    const results = fuse.search(message);
    const bestMatch = results[0];

    console.log("🔍 Pencocokan FAQ:", {
      userQuestion: message,
      matched: bestMatch?.item?.q || "Tidak ditemukan",
      score: bestMatch?.score,
    });

    // 🔸 Jika hasil cukup mirip, langsung balas
    if (bestMatch && bestMatch.score <= 0.4) {
      return res.json({
        reply: bestMatch.item.a,
        matchedQuestion: bestMatch.item.q,
        confidence: (1 - bestMatch.score).toFixed(2), // ubah score jadi “kemiripan”
      });
    }

    // 🔸 Jika tidak cukup mirip → gunakan reasoning dari Groq
    const context = buildContext(faqData);

    const systemPrompt =
      userLang === "en"
        ? `
You are a chatbot for a freelance marketplace app.
Answer ONLY based on the FAQ below.
If the user's question is similar, use the closest matching FAQ.
Don't say "I don't know" if it's related at all.

${context}

If it's truly unrelated, reply:
"Sorry, this question is outside the scope of my FAQ. Please contact support."
`
        : `
Kamu adalah chatbot aplikasi freelance marketplace.
Jawablah hanya berdasarkan FAQ berikut.
Jika pertanyaan mirip tapi tidak sama persis, gunakan FAQ yang paling relevan.
Jangan menjawab "tidak tahu" kalau masih berhubungan.

${context}

Jika benar-benar tidak relevan, balas:
"Maaf, pertanyaan ini di luar cakupan FAQ saya. Silakan hubungi support."
`;

    // 🔸 Kirim ke Groq API
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const answer = response.data.choices[0].message.content;
    res.json({ reply: answer });
  } catch (err) {
    console.error("Groq API error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Gagal mengambil jawaban dari AI",
    });
  }
};

